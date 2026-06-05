import { SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import crypto from 'crypto';
import { NextRequest } from 'next/server';

// 1. Setup mock database records
let mockOrders: any[] = [];
let mockApiCredentials: any[] = [];

// 2. Override SupabaseClient prototype for mocking database operations globally
const originalFrom = SupabaseClient.prototype.from;
SupabaseClient.prototype.from = function (table: string) {
  return {
    select: (columns: string) => ({
      eq: (col: string, val: any) => ({
        single: async () => {
          if (table === 'orders') {
            const row = mockOrders.find(o => o[col] === val);
            if (row) return { data: row, error: null };
            return { data: null, error: { message: 'Order not found' } };
          }
          if (table === 'api_credentials') {
            const row = mockApiCredentials.find(c => c[col] === val);
            if (row) return { data: row, error: null };
            return { data: null, error: { message: 'Credentials not found' } };
          }
          return { data: null, error: { message: 'Table not mocked' } };
        }
      })
    })
  } as any;
};

// 3. Override Redis prototype for mocking replay cache globally and preventing network connections
let mockRedisCache = new Map<string, string>();
let redisMockStatus: string = 'ready';
let redisStatusVal: string = 'connecting';

Object.defineProperty(Redis.prototype, 'status', {
  get: () => {
    return redisMockStatus || redisStatusVal;
  },
  set: (val: string) => {
    redisStatusVal = val;
  },
  configurable: true
});

// Disable actual background TCP connection attempts and simulate successful connection
Redis.prototype.connect = async function(this: any) {
  this.status = 'ready';
  process.nextTick(() => {
    this.emit('connect');
    this.emit('ready');
  });
};

Redis.prototype.disconnect = function() {
  return;
};

Redis.prototype.quit = async function() {
  return 'OK';
};

Redis.prototype.set = async function (key: string, value: string, ...args: any[]) {
  if (redisMockStatus !== 'ready') {
    throw new Error('Redis connection failure simulation.');
  }
  const hasNX = args.includes('NX');
  if (hasNX) {
    if (mockRedisCache.has(key)) {
      return null; // Already exists
    }
    mockRedisCache.set(key, value);
    return 'OK';
  }
  mockRedisCache.set(key, value);
  return 'OK';
} as any;

// Helper to encrypt secret using same AES-256-GCM logic as proxy route
import { encryptSecret } from '../../app/api/toss-proxy/route';

let POST: any;
let sweepInFlightOrders: any;

async function runTests() {
  // Pre-initialize environment variables to prevent module load failures
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key-12345';
  process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY = 'test-encryption-key-for-credentials-123';

  // Dynamically require route and scheduler to guarantee environment variables are in place
  const routeMod = await import('../../app/api/webhooks/toss/route');
  POST = routeMod.POST;
  const schedulerMod = await import('../queue/reconciler-scheduler');
  sweepInFlightOrders = schedulerMod.sweepInFlightOrders;

  // Dynamically import queues to mock brokerEventsQueue.add
  const queuesMod = await import('../queue/reconciler-queues');
  queuesMod.brokerEventsQueue.add = async (name: string, payload: any) => {
    console.log(`[Mock Queue] Intercepted BullMQ add: ${name}`);
    return {} as any;
  };

  console.log("====================================================");
  console.log("RUNNING PR-4 WEBHOOK & SESSION RECOVERY VERIFICATION");
  console.log("====================================================");

  const testUser = 'user-test-pr4';
  const testSecret = 'toss-my-secure-webhook-secret-key-123';
  const encryptedSecret = encryptSecret(testSecret);

  // Set initial database mocks
  mockOrders = [
    {
      client_order_id: 'order-valid-1',
      user_id: testUser,
      trading_mode: 'LIVE',
      status: 'SUBMITTED',
      created_at: new Date().toISOString()
    },
    {
      client_order_id: 'order-drift-1',
      user_id: testUser,
      trading_mode: 'LIVE',
      status: 'SUBMITTED',
      created_at: new Date().toISOString()
    }
  ];

  mockApiCredentials = [
    {
      user_id: testUser,
      encrypted_webhook_secret: encryptedSecret
    }
  ];

  // Helper to generate signature
  function generateSignature(timestamp: number, body: string, secret: string) {
    const computedPayload = `${timestamp}.${body}`;
    return crypto.createHmac('sha256', secret).update(computedPayload).digest('hex');
  }

  // --- Test 1: Successful webhook validation with correct signature and dynamic loading ---
  {
    console.log('\n[Test 1] Successful webhook signature validation...');
    const bodyObj = {
      execution_id: 'exec-valid-1',
      client_order_id: 'order-valid-1',
      broker_order_id: 'broker-valid-1',
      event_type: 'FULL_FILL',
      sequence_number: 1,
      filled_qty: 10,
      execution_price: 150000
    };
    const bodyStr = JSON.stringify(bodyObj);
    const timestamp = Date.now();
    const signature = generateSignature(timestamp, bodyStr, testSecret);

    const req = new NextRequest('http://localhost:3000/api/webhooks/toss', {
      method: 'POST',
      headers: {
        'x-toss-signature': signature,
        'x-toss-timestamp': timestamp.toString(),
        'Content-Type': 'application/json'
      },
      body: bodyStr
    });

    const res = await POST(req);
    console.log(`Response Status: ${res.status}`);
    const resBody = await res.json();
    console.log(`Response Body:`, resBody);

    if (res.status === 202 && resBody.success === true) {
      console.log('Test 1: ✅ PASS');
    } else {
      console.log('Test 1: ❌ FAIL');
    }
  }

  // --- Test 2: Invalid signature rejection ---
  {
    console.log('\n[Test 2] Invalid webhook signature rejection...');
    const bodyObj = {
      execution_id: 'exec-invalid-sig',
      client_order_id: 'order-valid-1',
      broker_order_id: 'broker-valid-1',
      event_type: 'FULL_FILL',
      sequence_number: 1,
      filled_qty: 10,
      execution_price: 150000
    };
    const bodyStr = JSON.stringify(bodyObj);
    const timestamp = Date.now();
    const signature = 'wrong-signature-value';

    const req = new NextRequest('http://localhost:3000/api/webhooks/toss', {
      method: 'POST',
      headers: {
        'x-toss-signature': signature,
        'x-toss-timestamp': timestamp.toString(),
        'Content-Type': 'application/json'
      },
      body: bodyStr
    });

    const res = await POST(req);
    console.log(`Response Status: ${res.status}`);
    const resBody = await res.json();
    console.log(`Response Body:`, resBody);

    if (res.status === 401 && resBody.error.includes('signature')) {
      console.log('Test 2: ✅ PASS');
    } else {
      console.log('Test 2: ❌ FAIL');
    }
  }

  // --- Test 3: Timestamp drift check (over 5 minutes) ---
  {
    console.log('\n[Test 3] Rejecting timestamp drift (over 5m)...');
    const bodyObj = {
      execution_id: 'exec-drift-1',
      client_order_id: 'order-drift-1',
      broker_order_id: 'broker-valid-1',
      event_type: 'FULL_FILL',
      sequence_number: 1,
      filled_qty: 10,
      execution_price: 150000
    };
    const bodyStr = JSON.stringify(bodyObj);
    const oldTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes old
    const signature = generateSignature(oldTimestamp, bodyStr, testSecret);

    const req = new NextRequest('http://localhost:3000/api/webhooks/toss', {
      method: 'POST',
      headers: {
        'x-toss-signature': signature,
        'x-toss-timestamp': oldTimestamp.toString(),
        'Content-Type': 'application/json'
      },
      body: bodyStr
    });

    const res = await POST(req);
    console.log(`Response Status: ${res.status}`);
    const resBody = await res.json();
    console.log(`Response Body:`, resBody);

    if (res.status === 401 && resBody.error.includes('expired')) {
      console.log('Test 3: ✅ PASS');
    } else {
      console.log('Test 3: ❌ FAIL');
    }
  }

  // --- Test 4: Replay protection deduplication ---
  {
    console.log('\n[Test 4] Replay attack protection (duplicate execution_id)...');
    const bodyObj = {
      execution_id: 'exec-replay-1',
      client_order_id: 'order-valid-1',
      broker_order_id: 'broker-valid-1',
      event_type: 'FULL_FILL',
      sequence_number: 1,
      filled_qty: 10,
      execution_price: 150000
    };
    const bodyStr = JSON.stringify(bodyObj);
    const timestamp = Date.now();
    const signature = generateSignature(timestamp, bodyStr, testSecret);

    // First request - should be accepted (202)
    const req1 = new NextRequest('http://localhost:3000/api/webhooks/toss', {
      method: 'POST',
      headers: {
        'x-toss-signature': signature,
        'x-toss-timestamp': timestamp.toString(),
        'Content-Type': 'application/json'
      },
      body: bodyStr
    });
    const res1 = await POST(req1);
    console.log(`First Request Status: ${res1.status}`);

    // Second request with same execution_id - should return 202 success but be skipped (deduplicated)
    const req2 = new NextRequest('http://localhost:3000/api/webhooks/toss', {
      method: 'POST',
      headers: {
        'x-toss-signature': signature,
        'x-toss-timestamp': timestamp.toString(),
        'Content-Type': 'application/json'
      },
      body: bodyStr
    });
    const res2 = await POST(req2);
    console.log(`Second Request Status: ${res2.status}`);
    const resBody2 = await res2.json();
    console.log(`Second Request Response Body:`, resBody2);

    if (res1.status === 202 && res2.status === 202 && resBody2.message.includes('already processed')) {
      console.log('Test 4: ✅ PASS');
    } else {
      console.log('Test 4: ❌ FAIL');
    }
  }

  // --- Test 5: Redis Outage failover (HTTP 503) ---
  {
    console.log('\n[Test 5] Redis outage failover to HTTP 503...');
    redisMockStatus = 'reconnecting'; // Simulate offline Redis

    const bodyObj = {
      execution_id: 'exec-outage-1',
      client_order_id: 'order-valid-1',
      broker_order_id: 'broker-valid-1',
      event_type: 'FULL_FILL',
      sequence_number: 1,
      filled_qty: 10,
      execution_price: 150000
    };
    const bodyStr = JSON.stringify(bodyObj);
    const timestamp = Date.now();
    const signature = generateSignature(timestamp, bodyStr, testSecret);

    const req = new NextRequest('http://localhost:3000/api/webhooks/toss', {
      method: 'POST',
      headers: {
        'x-toss-signature': signature,
        'x-toss-timestamp': timestamp.toString(),
        'Content-Type': 'application/json'
      },
      body: bodyStr
    });

    const res = await POST(req);
    console.log(`Response Status: ${res.status}`);
    const resBody = await res.json();
    console.log(`Response Body:`, resBody);
    console.log(`Retry-After Header:`, res.headers.get('Retry-After'));

    if (res.status === 503 && res.headers.get('Retry-After') === '60') {
      console.log('Test 5: ✅ PASS');
    } else {
      console.log('Test 5: ❌ FAIL');
    }

    redisMockStatus = 'ready'; // Reset Redis status
  }

  // --- Test 6: Reconciler LIVE Session crash fix ---
  {
    console.log('\n[Test 6] Reconciler LIVE Session crash verification...');
    
    // Construct a mock global client that has no session to simulate background sweeper
    const mockServiceRoleClient: any = {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null })
      },
      from: (table: string) => {
        return {
          select: () => ({
            in: (col1: string, val1: any) => ({
              lt: (col2: string, val2: any) => {
                // Return our mock stuck orders
                return {
                  data: [
                    {
                      client_order_id: 'order-valid-1',
                      user_id: testUser,
                      trading_mode: 'LIVE',
                      status: 'SUBMITTED',
                      created_at: new Date(Date.now() - 20000).toISOString()
                    }
                  ],
                  error: null
                };
              }
            })
          }),
          update: () => ({
            eq: async () => ({ error: null })
          })
        } as any;
      }
    };

    // Override fetch to ensure it receives x-worker-user-id and Authorization
    const originalFetch = global.fetch;
    let proxyInterceptHeaders: any = null;
    global.fetch = async (url: any, options: any) => {
      proxyInterceptHeaders = options.headers;
      return {
        ok: true,
        json: async () => ({
          success: true,
          broker_order_id: 'BROKER-12345',
          status: 'FILLED',
          filled_qty: 10,
          avg_fill_price: 150000,
          sequence_number: 2
        })
      } as any;
    };

    // Run sweepInFlightOrders - it should not throw and should successfully call the broker query
    let didCrash = false;
    try {
      await sweepInFlightOrders(mockServiceRoleClient);
    } catch (err: any) {
      console.error('Crash detected:', err.message);
      didCrash = true;
    }

    global.fetch = originalFetch;

    console.log('Intercepted Proxy Headers:', proxyInterceptHeaders);

    const hasCorrectUserContext = proxyInterceptHeaders && 
      proxyInterceptHeaders['x-worker-user-id'] === testUser && 
      proxyInterceptHeaders['Authorization'].startsWith('Bearer');

    const allPassed = !didCrash && hasCorrectUserContext;
    if (allPassed) {
      console.log('Test 6: ✅ PASS');
    } else {
      console.log('Test 6: ❌ FAIL');
    }

    console.log('\nAll PR-4 Verification Tests completed.');
    process.exit(allPassed ? 0 : 1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

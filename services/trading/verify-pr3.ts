import { sweepInFlightOrders } from '../queue/reconciler-scheduler';
import { brokerEventsQueue } from '../queue/reconciler-queues';
import { closeRedisClient } from '../../lib/redis';

// Setup environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key-12345';
process.env.APP_URL = 'http://localhost:3000';

// Mock minimal Supabase client
function createMockSupabase(orders: any[] = []) {
  const mockQueue: any[] = [];
  
  // Mock brokerEventsQueue
  brokerEventsQueue.add = async (name: string, payload: any) => {
    mockQueue.push({ name, payload });
    return {} as any;
  };

  const client: any = {
    auth: {
      getUser: async () => ({
        data: { user: { id: 'test-user-123' } },
        error: null
      }),
      getSession: async () => ({
        data: { session: { access_token: 'mock-access-token' } },
        error: null
      })
    },
    from: (table: string) => {
      return {
        select: () => ({
          in: (col1: string, val1: any) => ({
            lt: (col2: string, val2: any) => {
              // Filter active stuck orders
              const filtered = orders.filter(o => 
                val1.includes(o[col1]) && 
                new Date(o[col2]).getTime() < new Date(val2).getTime()
              );
              return { data: filtered, error: null };
            }
          })
        }),
        insert: async (payload: any) => {
          return { error: null };
        },
        update: async (updates: any) => {
          return {
            eq: async (col: string, val: any) => {
              return { error: null };
            }
          };
        }
      } as any;
    },
    _getQueuedEvents: () => mockQueue
  };

  return client;
}

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING PR-3 RECONCILIATION REDESIGN VERIFY");
  console.log("=========================================");

  // Save env variables
  const origMode = process.env.NEXT_PUBLIC_TRADING_MODE;

  // Test 1: Paper/Simulation sweeper behavior generating mock fills
  {
    console.log("\n[Test 1] Simulating PAPER mode sweeper...");
    process.env.NEXT_PUBLIC_TRADING_MODE = 'PAPER';

    const mockOrders = [
      {
        client_order_id: 'paper-stuck-1',
        user_id: 'test-user-123',
        symbol: 'AAPL',
        side: 'BUY',
        type: 'LIMIT',
        qty: 10,
        price: 150000,
        status: 'SUBMITTED',
        trading_mode: 'PAPER',
        last_sequence_number: 0,
        created_at: new Date(Date.now() - 20000).toISOString() // 20s old (stuck)
      }
    ];

    const mockSupabase = createMockSupabase(mockOrders);
    await sweepInFlightOrders(mockSupabase);

    const queued = mockSupabase._getQueuedEvents();
    const hasMockFill = queued.some((q: any) => 
      q.payload.event.client_order_id === 'paper-stuck-1' && 
      q.payload.event.event_type === 'FULL_FILL' &&
      q.payload.event.raw_payload.method === 'Tier-1-Sweeper'
    );

    console.log("Test 1 (Paper Sweeper Fills):", hasMockFill ? "✅ PASS" : "❌ FAIL");
  }

  // Test 2: Live mode sweeper behavior fetching order state from a mocked broker API
  {
    console.log("\n[Test 2] Simulating LIVE mode sweeper (Successful broker query)...");
    process.env.NEXT_PUBLIC_TRADING_MODE = 'LIVE';

    const mockOrders = [
      {
        client_order_id: 'live-stuck-1',
        user_id: 'test-user-123',
        symbol: 'AAPL',
        side: 'BUY',
        type: 'LIMIT',
        qty: 10,
        price: 150000,
        status: 'SUBMITTED',
        trading_mode: 'LIVE',
        last_sequence_number: 1,
        created_at: new Date(Date.now() - 20000).toISOString()
      }
    ];

    const mockSupabase = createMockSupabase(mockOrders);

    // Mock fetch to simulate successful proxy order status query
    const originalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
      return {
        ok: true,
        json: async () => ({
          success: true,
          broker_order_id: 'BROKER-LIVE-ORD-123',
          symbol: 'AAPL',
          side: '2',
          type: '02',
          qty: 10,
          price: 150000,
          status: 'FILLED',
          filled_qty: 10,
          avg_fill_price: 150000,
          sequence_number: 2
        })
      } as any;
    };

    await sweepInFlightOrders(mockSupabase);

    const queued = mockSupabase._getQueuedEvents();
    const hasLiveFill = queued.some((q: any) => 
      q.payload.event.client_order_id === 'live-stuck-1' && 
      q.payload.event.event_type === 'FULL_FILL' &&
      q.payload.event.broker_order_id === 'BROKER-LIVE-ORD-123' &&
      q.payload.event.raw_payload.broker_status === 'FILLED'
    );

    console.log("Test 2 (Live Sweeper Real Fills):", hasLiveFill ? "✅ PASS" : "❌ FAIL");
    global.fetch = originalFetch;
  }

  // Test 3: Broker outage, verifying orders remain unchanged (no ghost fills)
  {
    console.log("\n[Test 3] Simulating LIVE mode broker outage (Query fails)...");
    process.env.NEXT_PUBLIC_TRADING_MODE = 'LIVE';

    const mockOrders = [
      {
        client_order_id: 'live-stuck-2',
        user_id: 'test-user-123',
        symbol: 'AAPL',
        side: 'BUY',
        type: 'LIMIT',
        qty: 10,
        price: 150000,
        status: 'SUBMITTED',
        trading_mode: 'LIVE',
        last_sequence_number: 1,
        created_at: new Date(Date.now() - 20000).toISOString()
      }
    ];

    const mockSupabase = createMockSupabase(mockOrders);

    // Mock fetch to fail (simulation broker offline)
    const originalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Broker offline' })
      } as any;
    };

    await sweepInFlightOrders(mockSupabase);

    const queued = mockSupabase._getQueuedEvents();
    const skipped = queued.length === 0; // No events queued due to failure early return

    console.log("Test 3 (Live Outage Skips Fills):", skipped ? "✅ PASS" : "❌ FAIL");
    global.fetch = originalFetch;
  }

  // Test 4: "Order Not Found" scenario for young vs. old orders (timeout rejection threshold)
  {
    console.log("\n[Test 4] Simulating LIVE mode Order Not Found (Young vs Old)...");
    process.env.NEXT_PUBLIC_TRADING_MODE = 'LIVE';

    const mockOrders = [
      {
        client_order_id: 'live-young-stuck',
        user_id: 'test-user-123',
        symbol: 'AAPL',
        side: 'BUY',
        type: 'LIMIT',
        qty: 10,
        price: 150000,
        status: 'SUBMITTED',
        trading_mode: 'LIVE',
        last_sequence_number: 1,
        created_at: new Date(Date.now() - 30000).toISOString() // 30s old (under 5m)
      },
      {
        client_order_id: 'live-old-stuck',
        user_id: 'test-user-123',
        symbol: 'AAPL',
        side: 'BUY',
        type: 'LIMIT',
        qty: 10,
        price: 150000,
        status: 'SUBMITTED',
        trading_mode: 'LIVE',
        last_sequence_number: 1,
        created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString() // 6 minutes old (over 5m)
      }
    ];

    const mockSupabase = createMockSupabase(mockOrders);

    // Mock fetch to return Order Not Found
    const originalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
      return {
        ok: true,
        json: async () => ({ error: 'Order not found' })
      } as any;
    };

    await sweepInFlightOrders(mockSupabase);

    const queued = mockSupabase._getQueuedEvents();

    const isYoungSkipped = !queued.some((q: any) => q.payload.event.client_order_id === 'live-young-stuck');
    const isOldRejected = queued.some((q: any) => 
      q.payload.event.client_order_id === 'live-old-stuck' && 
      q.payload.event.event_type === 'REJECT'
    );

    console.log("Young order within 5m grace period skipped:", isYoungSkipped ? "✅ Yes" : "❌ No");
    console.log("Old order exceeding 5m timeout rejected:", isOldRejected ? "✅ Yes" : "❌ No");
    console.log("Test 4 (Rejection Timeout Threshold):",
      isYoungSkipped && isOldRejected ? "✅ PASS" : "❌ FAIL"
    );

    global.fetch = originalFetch;
  }

  // Restore env
  process.env.NEXT_PUBLIC_TRADING_MODE = origMode;
  await brokerEventsQueue.close();
  await closeRedisClient();
}

runTests().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});

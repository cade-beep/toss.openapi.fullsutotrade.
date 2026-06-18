/* eslint-disable */
import { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

// Setup environment variables before importing routes
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key-12345';
process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY = 'test-encryption-key-for-credentials-123';
process.env.NEXT_PUBLIC_TRADING_MODE = 'LIVE';
process.env.TOSS_API_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_AUTH_ENABLED = 'true';

// Global mocks
let mockAuthUserResult: { data: { user: any } | null; error: any } = {
  data: { user: { id: 'test-user-123', email: 'test@example.com' } },
  error: null
};

// Database operations spy
let selectMockResult: any = null;
let upsertMockPayload: any = null;
let deleteMockCalled = false;

SupabaseClient.prototype.auth = {
  getUser: async (token?: string) => {
    return mockAuthUserResult;
  },
  getSession: async () => {
    return { data: { session: { access_token: 'mock-access-token' } }, error: null };
  }
} as any;

SupabaseClient.prototype.from = function (table: string) {
  return {
    select: (columns: string) => ({
      eq: (col: string, val: any) => ({
        maybeSingle: async () => {
          if (table === 'api_credentials') {
            return { data: selectMockResult, error: null };
          }
          return { data: null, error: { message: 'Table not mocked' } };
        }
      })
    }),
    upsert: (payload: any) => {
      if (table === 'api_credentials') {
        upsertMockPayload = payload;
        return { error: null };
      }
      return { error: { message: 'Table not mocked' } };
    },
    delete: () => ({
      eq: (col: string, val: any) => {
        if (table === 'api_credentials') {
          deleteMockCalled = true;
          return { error: null };
        }
        return { error: { message: 'Table not mocked' } };
      }
    })
  } as any;
};

// Mock global fetch for auth token verification
const originalFetch = global.fetch;
global.fetch = async (url: any, options: any) => {
  const urlStr = url.toString();
  if (urlStr.includes('/auth/v1/user')) {
    return {
      status: 200,
      ok: true,
      json: async () => ({
        user: { id: 'test-user-123', email: 'test@example.com' }
      })
    } as any;
  }
  if (urlStr.includes('/v1/account/balance')) {
    return {
      status: 200,
      ok: true,
      json: async () => ({
        cash_balance: 10000000
      })
    } as any;
  }
  if (urlStr.includes('/oauth2/token')) {
    return {
      status: 200,
      ok: true,
      json: async () => ({
        access_token: 'mock-access-token-123',
        token_type: 'Bearer',
        expires_in: 3600
      })
    } as any;
  }
  if (urlStr.includes('/api/v1/buying-power')) {
    return {
      status: 200,
      ok: true,
      json: async () => ({
        buying_power: 10000000
      })
    } as any;
  }
  return { 
    status: 404,
    ok: false,
    json: async () => ({ error: 'Not found' })
  } as any;
};

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING PR-6A CREDENTIALS CRUD & TEST TESTS");
  console.log("=========================================");

  // Import handlers dynamically
  const credentialsMod = await import('./app/api/credentials/route');
  const GET = credentialsMod.GET;
  const POST_SAVE = credentialsMod.POST;
  const DELETE = credentialsMod.DELETE;

  const testMod = await import('./app/api/credentials/test/route');
  const POST_TEST = testMod.POST;

  const baseHeaders = {
    'Authorization': 'Bearer mock-user-token',
    'Content-Type': 'application/json'
  };

  // --- Test 1.1: GET (Credentials not configured) ---
  {
    console.log('\n[Test 1.1] GET /api/credentials (Credentials not configured)...');
    selectMockResult = null;
    
    const req = new NextRequest('http://localhost:3000/api/credentials', {
      method: 'GET',
      headers: baseHeaders
    });
    const res = await GET(req);
    const body = await res.json();

    console.log(`Status: ${res.status}`);
    console.log(`Body:`, body);

    if (res.status === 200 && body.exists === false) {
      console.log('Test 1.1: ✅ PASS');
    } else {
      console.log('Test 1.1: ❌ FAIL');
      process.exit(1);
    }
  }

  // --- Test 1.2: GET (Credentials configured) ---
  {
    console.log('\n[Test 1.2] GET /api/credentials (Credentials exist)...');
    selectMockResult = {
      account_id: 'test-account-id',
      is_simulation: false,
      encrypted_api_key: 'dummy-encrypted-key',
      encrypted_secret_key: 'dummy-encrypted-secret'
    };
    
    const req = new NextRequest('http://localhost:3000/api/credentials', {
      method: 'GET',
      headers: baseHeaders
    });
    const res = await GET(req);
    const body = await res.json();

    console.log(`Status: ${res.status}`);
    console.log(`Body:`, body);

    const isSafe = body.exists === true && 
                   body.accountId === 'test-account-id' &&
                   body.isSimulation === false &&
                   body.apiKey === undefined && 
                   body.secretKey === undefined;

    if (res.status === 200 && isSafe) {
      console.log('Test 1.2: ✅ PASS');
    } else {
      console.log('Test 1.2: ❌ FAIL', { isSafe });
      process.exit(1);
    }
  }

  // --- Test 2.1: POST (Save - validation error) ---
  {
    console.log('\n[Test 2.1] POST /api/credentials (Save - missing fields)...');
    upsertMockPayload = null;

    const req = new NextRequest('http://localhost:3000/api/credentials', {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ apiKey: 'key1' }) // Missing secretKey and accountId
    });
    const res = await POST_SAVE(req);
    const body = await res.json();

    console.log(`Status: ${res.status}`);
    console.log(`Body:`, body);

    if (res.status === 400 && body.error.includes('Validation Error')) {
      console.log('Test 2.1: ✅ PASS');
    } else {
      console.log('Test 2.1: ❌ FAIL');
      process.exit(1);
    }
  }

  // --- Test 2.2: POST (Save - success) ---
  {
    console.log('\n[Test 2.2] POST /api/credentials (Save - success)...');
    upsertMockPayload = null;

    const req = new NextRequest('http://localhost:3000/api/credentials', {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({
        apiKey: 'real-toss-api-key-here',
        secretKey: 'real-toss-secret-signing-key-here',
        accountId: '777-ACCOUNT-999'
      })
    });
    const res = await POST_SAVE(req);
    const body = await res.json();

    console.log(`Status: ${res.status}`);
    console.log(`Body:`, body);

    const isPayloadCorrect = upsertMockPayload && 
                             upsertMockPayload.account_id === '777-ACCOUNT-999' &&
                             upsertMockPayload.encrypted_api_key.includes(':') &&
                             upsertMockPayload.encrypted_secret_key.includes(':');

    if (res.status === 200 && body.success === true && isPayloadCorrect) {
      console.log('Test 2.2: ✅ PASS');
    } else {
      console.log('Test 2.2: ❌ FAIL', { isPayloadCorrect });
      process.exit(1);
    }
  }

  // --- Test 3.1: POST (Test Connection - invalid formatting) ---
  {
    console.log('\n[Test 3.1] POST /api/credentials/test (Connection Test - invalid key length)...');
    const req = new NextRequest('http://localhost:3000/api/credentials/test', {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({
        apiKey: 'key', // too short (<5)
        secretKey: 'secret',
        accountId: 'acc'
      })
    });
    const res = await POST_TEST(req);
    const body = await res.json();

    console.log(`Status: ${res.status}`);
    console.log(`Body:`, body);

    if (res.status === 400 && body.error.includes('Invalid API Key')) {
      console.log('Test 3.1: ✅ PASS');
    } else {
      console.log('Test 3.1: ❌ FAIL');
      process.exit(1);
    }
  }

  // --- Test 3.2: POST (Test Connection - success simulation fallback) ---
  {
    console.log('\n[Test 3.2] POST /api/credentials/test (Connection Test - success)...');
    const req = new NextRequest('http://localhost:3000/api/credentials/test', {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({
        apiKey: 'valid-toss-api-key',
        secretKey: 'valid-toss-secret-key',
        accountId: 'valid-toss-account-id'
      })
    });
    const res = await POST_TEST(req);
    const body = await res.json();

    console.log(`Status: ${res.status}`);
    console.log(`Body:`, body);

    if (res.status === 200 && body.success === true) {
      console.log('Test 3.2: ✅ PASS');
    } else {
      console.log('Test 3.2: ❌ FAIL');
      process.exit(1);
    }
  }

  // --- Test 4: DELETE (Delete) ---
  {
    console.log('\n[Test 4] DELETE /api/credentials (Wipe credentials)...');
    deleteMockCalled = false;

    const req = new NextRequest('http://localhost:3000/api/credentials', {
      method: 'DELETE',
      headers: baseHeaders
    });
    const res = await DELETE(req);
    const body = await res.json();

    console.log(`Status: ${res.status}`);
    console.log(`Body:`, body);

    if (res.status === 200 && body.success === true && deleteMockCalled) {
      console.log('Test 4: ✅ PASS');
    } else {
      console.log('Test 4: ❌ FAIL', { deleteMockCalled });
      process.exit(1);
    }
  }

  console.log("\n=========================================");
  console.log("PR-6A VERIFICATION COMPLETED SUCCESSFULLY!");
  console.log("=========================================");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

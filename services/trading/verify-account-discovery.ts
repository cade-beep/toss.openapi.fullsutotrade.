/* eslint-disable */
import { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { tossTokenCache } from './toss-token-cache';

// Setup environment variables before importing the route module
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key-12345';
process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY = 'test-encryption-key-for-credentials-123';
process.env.TOSS_API_URL = 'http://mock-toss-api.com';
process.env.NEXT_PUBLIC_TRADING_MODE = 'LIVE';

// Global mock database and network states
let mockApiCredentialsResult: { data: any; error: any } = { data: null, error: null };
let dbUpdates: Record<string, any>[] = [];

let oauthCallCount = 0;
let accountsCallCount = 0;
let targetCallCount = 0;
let lastTargetHeaders: Record<string, string> = {};

const originalFetch = global.fetch;
global.fetch = async (url: any, options: any) => {
  const urlStr = url.toString();

  // Mock Supabase Auth getUser check
  if (urlStr.includes('/auth/v1/user')) {
    return {
      status: 200,
      ok: true,
      json: async () => ({
        user: { id: 'test-user-123', email: 'test@example.com' }
      })
    } as any;
  }

  // Mock Toss Auth token endpoint
  if (urlStr.includes('/oauth2/token')) {
    oauthCallCount++;
    return {
      status: 200,
      ok: true,
      json: async () => ({
        access_token: 'mocked-oauth-token',
        token_type: 'Bearer',
        expires_in: 3600
      })
    } as any;
  }

  // Mock Toss Account Discovery endpoint
  if (urlStr.includes('/api/v1/accounts')) {
    accountsCallCount++;
    lastTargetHeaders = {};
    if (options?.headers) {
      Object.entries(options.headers).forEach(([k, v]) => {
        lastTargetHeaders[k.toLowerCase()] = String(v);
      });
    }
    return {
      status: 200,
      ok: true,
      json: async () => ({
        result: [
          { accountNo: 'pension-123', accountSeq: 999, accountType: 'PENSION' },
          { accountNo: 'brokerage-456', accountSeq: 888, accountType: 'BROKERAGE' }
        ]
      })
    } as any;
  }

  // Mock target resources (like holdings/orders) forward
  let parsedHost = '';
  try {
    parsedHost = new URL(urlStr).hostname;
  } catch {
    parsedHost = '';
  }
  if (parsedHost === 'mock-toss-api.com') {
    targetCallCount++;
    lastTargetHeaders = {};
    if (options?.headers) {
      Object.entries(options.headers).forEach(([k, v]) => {
        lastTargetHeaders[k.toLowerCase()] = String(v);
      });
    }
    return {
      status: 200,
      ok: true,
      json: async () => ({ success: true, payload: 'resource-data' })
    } as any;
  }

  return { ok: false, status: 404 } as any;
};

// Override SupabaseClient methods for database mocking
SupabaseClient.prototype.auth = {
  getUser: async (token?: string) => {
    return { data: { user: { id: 'test-user-123' } }, error: null };
  },
  getSession: async () => {
    return { data: { session: { access_token: 'mock-access-token' } }, error: null };
  }
} as any;

SupabaseClient.prototype.from = function (table: string) {
  return {
    select: (columns: string) => ({
      eq: (col: string, val: any) => ({
        single: async () => {
          if (table === 'api_credentials') {
            return mockApiCredentialsResult;
          }
          return { data: null, error: { message: 'Table not mocked' } };
        }
      })
    }),
    update: (updates: any) => {
      dbUpdates.push(updates);
      return {
        eq: (col: string, val: any) => ({
          then: (onfulfilled: any) => Promise.resolve({ error: null }).then(onfulfilled)
        })
      };
    }
  } as any;
};

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING PR-13 PHASE 2: ACCOUNT DISCOVERY");
  console.log("=========================================");

  // Clear caches
  tossTokenCache.clear();

  const routeMod = await import('../../app/api/toss-proxy/route');
  const POST = routeMod.POST;
  const encryptSecret = routeMod.encryptSecret;

  const testUser = 'test-user-123';
  const encryptedApiKey = encryptSecret('my-client-id');
  const encryptedSecretKey = encryptSecret('my-client-secret');

  // Helper to create POST proxy request
  function createProxyRequest(path: string, body: any = null) {
    return new NextRequest('http://localhost:3000/api/toss-proxy', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-user-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ method: 'GET', path, body })
    });
  }

  // -------------------------------------------------------------
  // Test A: Account Discovery runs when account_id is empty
  // -------------------------------------------------------------
  {
    console.log('\n[Test A] Testing Account Discovery on empty account_id...');
    mockApiCredentialsResult = {
      data: {
        user_id: testUser,
        encrypted_api_key: encryptedApiKey,
        encrypted_secret_key: encryptedSecretKey,
        account_id: null,
        is_simulation: false
      },
      error: null
    };

    oauthCallCount = 0;
    accountsCallCount = 0;
    targetCallCount = 0;
    dbUpdates = [];

    const req = createProxyRequest('/api/v1/holdings');
    const res = await POST(req);
    const resBody = await res.json();

    console.log(`- Response status: ${res.status}`);
    console.log(`- Token cache fetch count: ${oauthCallCount} (Expected 1)`);
    console.log(`- Accounts discovery count: ${accountsCallCount} (Expected 1)`);
    console.log(`- Target resource forward count: ${targetCallCount} (Expected 1)`);
    console.log(`- Saved account_id in database update:`, dbUpdates[0]?.account_id);
    console.log(`- Injected X-Tossinvest-Account header:`, lastTargetHeaders['x-tossinvest-account']);

    const checkDiscovery = res.status === 200 &&
                           oauthCallCount === 1 &&
                           accountsCallCount === 1 &&
                           targetCallCount === 1 &&
                           dbUpdates[0]?.account_id === '888' &&
                           lastTargetHeaders['x-tossinvest-account'] === '888' &&
                           lastTargetHeaders['authorization'] === 'Bearer mocked-oauth-token';

    console.log('Test A: ', checkDiscovery ? '✅ PASS' : '❌ FAIL');
    if (!checkDiscovery) throw new Error("Test A failed");
  }

  // -------------------------------------------------------------
  // Test B: Account Discovery is skipped when account_id is present
  // -------------------------------------------------------------
  {
    console.log('\n[Test B] Testing Account Discovery skip when account_id is present...');
    mockApiCredentialsResult = {
      data: {
        user_id: testUser,
        encrypted_api_key: encryptedApiKey,
        encrypted_secret_key: encryptedSecretKey,
        account_id: '777', // Already cached sequence
        is_simulation: false
      },
      error: null
    };

    oauthCallCount = 0;
    accountsCallCount = 0;
    targetCallCount = 0;
    dbUpdates = [];

    const req = createProxyRequest('/api/v1/holdings');
    const res = await POST(req);
    const resBody = await res.json();

    console.log(`- Response status: ${res.status}`);
    console.log(`- Accounts discovery count: ${accountsCallCount} (Expected 0 - cached)`);
    console.log(`- Target resource forward count: ${targetCallCount} (Expected 1)`);
    console.log(`- Injected X-Tossinvest-Account header:`, lastTargetHeaders['x-tossinvest-account']);

    const checkSkip = res.status === 200 &&
                      accountsCallCount === 0 &&
                      targetCallCount === 1 &&
                      lastTargetHeaders['x-tossinvest-account'] === '777';

    console.log('Test B: ', checkSkip ? '✅ PASS' : '❌ FAIL');
    if (!checkSkip) throw new Error("Test B failed");
  }

  // -------------------------------------------------------------
  // Test C: Header is NOT injected for oauth/accounts paths
  // -------------------------------------------------------------
  {
    console.log('\n[Test C] Testing X-Tossinvest-Account is omitted on auth/discovery paths...');
    mockApiCredentialsResult = {
      data: {
        user_id: testUser,
        encrypted_api_key: encryptedApiKey,
        encrypted_secret_key: encryptedSecretKey,
        account_id: '777',
        is_simulation: false
      },
      error: null
    };

    accountsCallCount = 0;
    lastTargetHeaders = {};

    const req = createProxyRequest('/api/v1/accounts');
    const res = await POST(req);

    console.log(`- Discovery endpoint call count: ${accountsCallCount} (Expected 1)`);
    console.log(`- Injected X-Tossinvest-Account header:`, lastTargetHeaders['x-tossinvest-account'] || 'OMITTED');

    const checkOmission = res.status === 200 &&
                          accountsCallCount === 1 &&
                          lastTargetHeaders['x-tossinvest-account'] === undefined;

    console.log('Test C: ', checkOmission ? '✅ PASS' : '❌ FAIL');
    if (!checkOmission) throw new Error("Test C failed");
  }

  // Restore fetch
  global.fetch = originalFetch;

  console.log("\n=========================================");
  console.log("PR-13 PHASE 2 VERIFICATION PASSED!");
  console.log("=========================================");
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});

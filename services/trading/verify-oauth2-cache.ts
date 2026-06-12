import { TossTokenCache } from './toss-token-cache';

async function runTests() {
  console.log("====================================================");
  console.log("RUNNING OAUTH2 TOKEN CACHE & CONCURRENCY UNIT TESTS");
  console.log("====================================================");

  const mockApiUrl = 'https://mock-toss-openapi.com';
  const originalFetch = global.fetch;
  let fetchCallCount = 0;
  let responseDelayMs = 0;
  let mockToken = 'initial-jwt-token';
  let mockExpiresIn = 3600; // 1 hour
  let shouldFail = false;

  // Mock global fetch
  global.fetch = (async (url: string, options: any) => {
    fetchCallCount++;
    if (responseDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, responseDelayMs));
    }

    if (shouldFail) {
      return {
        ok: false,
        status: 401,
        json: async () => ({
          error: 'invalid_client',
          error_description: 'Client authentication failed: client_id'
        })
      } as any;
    }

    // Verify correct x-www-form-urlencoded params are posted
    const bodyStr = options?.body || '';
    const params = new URLSearchParams(bodyStr);
    const grantType = params.get('grant_type');
    const clientId = params.get('client_id');
    const clientSecret = params.get('client_secret');

    if (grantType !== 'client_credentials' || !clientId || !clientSecret) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_request', error_description: 'Bad request params' })
      } as any;
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        access_token: mockToken,
        token_type: 'Bearer',
        expires_in: mockExpiresIn
      })
    } as any;
  }) as any;

  try {
    const cache = new TossTokenCache(mockApiUrl);

    // -------------------------------------------------------------
    // Test 1: Cache Miss & Token Fetching
    // -------------------------------------------------------------
    {
      console.log("\n[Test 1] Testing basic cache miss and retrieval...");
      fetchCallCount = 0;
      mockToken = 'test-token-1';
      mockExpiresIn = 3600;

      const token = await cache.getToken('client_abc', 'secret_123');
      
      const success = (token === 'test-token-1') && (fetchCallCount === 1);
      console.log(`- Token retrieved: ${token}`);
      console.log(`- Fetch count: ${fetchCallCount}`);
      console.log(`- Result:`, success ? "✅ PASS" : "❌ FAIL");
      if (!success) throw new Error("Test 1 failed");
    }

    // -------------------------------------------------------------
    // Test 2: Cache Hit (Expiration safety zone active)
    // -------------------------------------------------------------
    {
      console.log("\n[Test 2] Testing cache hit (no new fetch)...");
      fetchCallCount = 0;

      const token = await cache.getToken('client_abc', 'secret_123');

      const success = (token === 'test-token-1') && (fetchCallCount === 0);
      console.log(`- Token retrieved: ${token}`);
      console.log(`- Fetch count: ${fetchCallCount} (Expected 0)`);
      console.log(`- Result:`, success ? "✅ PASS" : "❌ FAIL");
      if (!success) throw new Error("Test 2 failed");
    }

    // -------------------------------------------------------------
    // Test 3: Expiration Refresh (Token expired or inside safety buffer)
    // -------------------------------------------------------------
    {
      console.log("\n[Test 3] Testing token expiration and refresh trigger...");
      fetchCallCount = 0;
      mockToken = 'test-token-2';

      // Mock expired token (expiresAt = now - 1000)
      cache.setCacheItem('client_abc', 'test-token-1', Date.now() - 1000);

      const token = await cache.getToken('client_abc', 'secret_123');

      const success = (token === 'test-token-2') && (fetchCallCount === 1);
      console.log(`- Token retrieved: ${token}`);
      console.log(`- Fetch count: ${fetchCallCount} (Expected 1)`);
      console.log(`- Result:`, success ? "✅ PASS" : "❌ FAIL");
      if (!success) throw new Error("Test 3 failed");
    }

    // -------------------------------------------------------------
    // Test 4: Expiration Safety Buffer Zone (within 60 seconds of expiry)
    // -------------------------------------------------------------
    {
      console.log("\n[Test 4] Testing safety buffer zone refresh (expires in 30 seconds)...");
      fetchCallCount = 0;
      mockToken = 'test-token-3';

      // Mock token expiring in 30 seconds (expiresAt = now + 30000)
      cache.setCacheItem('client_abc', 'test-token-2', Date.now() + 30000);

      const token = await cache.getToken('client_abc', 'secret_123');

      const success = (token === 'test-token-3') && (fetchCallCount === 1);
      console.log(`- Token retrieved: ${token}`);
      console.log(`- Fetch count: ${fetchCallCount} (Expected 1 due to 60s safety buffer)`);
      console.log(`- Result:`, success ? "✅ PASS" : "❌ FAIL");
      if (!success) throw new Error("Test 4 failed");
    }

    // -------------------------------------------------------------
    // Test 5: Concurrent Refreshes Prevention
    // -------------------------------------------------------------
    {
      console.log("\n[Test 5] Testing concurrent refresh prevention...");
      cache.clear();
      fetchCallCount = 0;
      responseDelayMs = 100; // Artificial network delay
      mockToken = 'concurrent-token';

      // Send 3 requests concurrently
      const promises = [
        cache.getToken('client_abc', 'secret_123'),
        cache.getToken('client_abc', 'secret_123'),
        cache.getToken('client_abc', 'secret_123')
      ];

      // Verify lock is set
      const isLockActive = cache.isRefreshActive('client_abc');
      console.log(`- Is refresh promise map lock active during calls:`, isLockActive ? "✅ Yes" : "❌ No");

      const tokens = await Promise.all(promises);

      // Verify lock is released
      const isLockReleased = !cache.isRefreshActive('client_abc');
      console.log(`- Is refresh promise map lock released after calls:`, isLockReleased ? "✅ Yes" : "❌ No");

      const allTokensEqual = tokens.every(t => t === 'concurrent-token');
      const success = allTokensEqual && (fetchCallCount === 1) && isLockActive && isLockReleased;

      console.log(`- Retrieved tokens: ${JSON.stringify(tokens)}`);
      console.log(`- Fetch count: ${fetchCallCount} (Expected exactly 1)`);
      console.log(`- Result:`, success ? "✅ PASS" : "❌ FAIL");
      if (!success) throw new Error("Test 5 failed");
      
      responseDelayMs = 0; // reset
    }

    // -------------------------------------------------------------
    // Test 6: Network Failure / Error Handling
    // -------------------------------------------------------------
    {
      console.log("\n[Test 6] Testing server error propagation...");
      cache.clear();
      fetchCallCount = 0;
      shouldFail = true;

      let errorThrown = false;
      try {
        await cache.getToken('client_abc', 'secret_123');
      } catch (err: any) {
        errorThrown = true;
        console.log(`- Correctly caught error: ${err.message}`);
      }

      const success = errorThrown && (fetchCallCount === 1);
      console.log(`- Result:`, success ? "✅ PASS" : "❌ FAIL");
      if (!success) throw new Error("Test 6 failed");
    }

    console.log("\n====================================================");
    console.log("ALL OAUTH2 CACHE TESTS COMPLETED SUCCESSFULLY!");
    console.log("====================================================");

  } finally {
    // Restore fetch
    global.fetch = originalFetch;
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

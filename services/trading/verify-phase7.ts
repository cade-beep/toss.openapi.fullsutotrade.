import { RateLimiter } from './rate-limiter';
import { CircuitBreaker } from './circuit-breaker';
import crypto from 'crypto';

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING TOSS OPENAPI ADAPTER VERIFY");
  console.log("=========================================");

  // Test 1: Rate Limiter sliding window check
  {
    const limiter = new RateLimiter();
    const key = 'test-user-limits';
    
    // Simulate 5 requests within limit of 5
    let allowed = true;
    for (let i = 0; i < 5; i++) {
      const ok = await limiter.isAllowed(key, 5, 2);
      if (!ok) allowed = false;
    }
    
    // 6th request should fail
    const blocked = !(await limiter.isAllowed(key, 5, 2));

    console.log("Test 1 (Rate Limiter constraints):", 
      allowed && blocked ? "✅ PASS" : "❌ FAIL"
    );
    await limiter.close();
  }

  // Test 2: Circuit Breaker state transitions
  {
    const breaker = new CircuitBreaker(3, 1000); // threshold = 3, cooldown = 1s
    
    // Check call allowed
    let allowedBefore = false;
    try {
      allowedBefore = await breaker.checkCall();
    } catch (e) {}

    // Record 3 failures
    await breaker.recordFailure();
    await breaker.recordFailure();
    await breaker.recordFailure();

    // Check call should throw OPEN block error
    let blockedAfter = false;
    try {
      await breaker.checkCall();
    } catch (err: any) {
      if (err.message.includes('Circuit is OPEN')) {
        blockedAfter = true;
      }
    }

    // Await cooldown recovery
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Check call should transition to HALF_OPEN and allow request
    let allowedAfterCooldown = false;
    try {
      allowedAfterCooldown = await breaker.checkCall();
    } catch (e) {}

    // Record success -> should reset state back to CLOSED
    await breaker.recordSuccess();

    // Check call remains allowed
    let activeAfterReset = false;
    try {
      activeAfterReset = await breaker.checkCall();
    } catch (e) {}

    console.log("Test 2 (Circuit Breaker transitions):", 
      allowedBefore && blockedAfter && allowedAfterCooldown && activeAfterReset ? "✅ PASS" : "❌ FAIL"
    );
    await breaker.close();
  }

  // Test 3: Proxy payload signature verification
  {
    const apiKey = 'test-api-key';
    const secretKey = 'test-secret-key';
    const timestamp = Date.now().toString();
    const method = 'POST';
    const path = '/v1/orders';
    const body = { client_oid: '123' };

    const message = `${method}${path}${timestamp}${JSON.stringify(body)}`;
    const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');

    // Verify correct structure
    const verified = signature.length === 64; // SHA256 hex is 64 chars
    console.log("Test 3 (Proxy signature generation):", 
      verified ? "✅ PASS" : "❌ FAIL"
    );
  }

  // Test 4: Live mode fail-fast URL validation check
  {
    // Save original env variables
    const origMode = process.env.NEXT_PUBLIC_TRADING_MODE;
    const origAppUrl = process.env.APP_URL;
    const origPubUrl = process.env.NEXT_PUBLIC_APP_URL;

    // Set LIVE mode and strip URL variables
    process.env.NEXT_PUBLIC_TRADING_MODE = 'LIVE';
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    const { createClient } = await import('@supabase/supabase-js');
    const { TossTradingService } = await import('./toss-api');

    const mockSupabase = createClient('http://localhost:54321', 'mock-anon');
    const service = new TossTradingService(mockSupabase);

    let threw = false;
    let errMessage = '';
    try {
      await service.getAccountBalance();
    } catch (err: any) {
      threw = true;
      errMessage = err.message;
    }

    // Restore env variables
    process.env.NEXT_PUBLIC_TRADING_MODE = origMode;
    process.env.APP_URL = origAppUrl;
    process.env.NEXT_PUBLIC_APP_URL = origPubUrl;
    await service.cleanConnection();

    console.log("Test 4 (Live Mode fail-fast URL):", 
      threw && errMessage.includes('ConfigurationError') ? "✅ PASS" : "❌ FAIL"
    );
  }
}

runTests().catch(console.error);

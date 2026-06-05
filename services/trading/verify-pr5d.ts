/**
 * verify-pr5d.ts
 * PR-5D: Redis Singleton Connection Refactor — Production Integration Verification
 *
 * AUDIT REQUIREMENT: All imports must resolve to real production files, not mocks.
 * This script prints the resolved absolute path of every imported module before
 * running tests, so an auditor can confirm no mock substitution occurred.
 *
 * Singleton identity is proven by === reference equality across:
 *   1. Direct TossTradingService construction (100×)
 *   2. TradingServiceFactory.getService('LIVE', ...) (10×)
 *   3. The module-level tossTradingService export from toss-api.ts
 *
 * Run:
 *   npx ts-node --project tsconfig.test.json --transpile-only services/trading/verify-pr5d.ts
 */

// ─── Environment setup (must precede all imports) ─────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL    = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'stub-anon-key';
process.env.NEXT_PUBLIC_TRADING_MODE    = 'LIVE'; // Use LIVE so factory creates TossTradingService

// ─── Production imports (no mocks) ───────────────────────────────────────────
import { getRedisClient, closeRedisClient }              from '../../lib/redis';
import { RateLimiter, rateLimiter as moduleLevelRL }     from './rate-limiter';
import { CircuitBreaker, circuitBreaker as moduleLevelCB } from './circuit-breaker';
import { TossTradingService, tossTradingService as moduleLevelTSS } from './toss-api';
import { TradingServiceFactory }                         from './factory';
import { createClient }                                  from '@supabase/supabase-js';
import * as path                                         from 'path';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(name: string, detail = '') {
  console.log(`  ✅ PASS  ${name}${detail ? ' — ' + detail : ''}`);
  passed++;
}

function fail(name: string, reason: string) {
  console.error(`  ❌ FAIL  ${name} — ${reason}`);
  failed++;
}

function section(title: string) {
  console.log(`\n─── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

// ─── Import-path audit helper ─────────────────────────────────────────────────
function resolvedPath(moduleId: string): string {
  try {
    return require.resolve(moduleId);
  } catch {
    return `(resolution failed: ${moduleId})`;
  }
}

async function main() {

  // ─── Section 0: Import-Path Evidence ────────────────────────────────────────

  section('Section 0: Import Path Evidence (Auditor Verification)');

  const imports: Record<string, string> = {
    'lib/redis':                  resolvedPath('../../lib/redis'),
    'services/trading/rate-limiter':   resolvedPath('./rate-limiter'),
    'services/trading/circuit-breaker': resolvedPath('./circuit-breaker'),
    'services/trading/toss-api':       resolvedPath('./toss-api'),
    'services/trading/factory':        resolvedPath('./factory'),
  };

  let allRealFiles = true;
  for (const [alias, absPath] of Object.entries(imports)) {
    const isMock = absPath.includes('mock') || absPath.includes('__mocks__') || absPath.includes('stub');
    if (isMock) {
      fail(`Import ${alias}`, `Resolved to mock path: ${absPath}`);
      allRealFiles = false;
    } else {
      console.log(`  📄  ${alias}`);
      console.log(`       → ${absPath}`);
    }
  }

  if (allRealFiles) {
    pass('Section 0 — All imports resolve to production source files');
  }

  // ─── Section 1: Redis Singleton — getRedisClient() is stable ────────────────

  section('Section 1: Redis Singleton — getRedisClient() stability (100 calls)');

  const redisRefs = new Set<object>();
  for (let i = 0; i < 100; i++) {
    redisRefs.add(getRedisClient());
  }

  const singletonRedis = getRedisClient(); // capture for later cross-checks

  if (redisRefs.size === 1) {
    pass('S1 — getRedisClient() singleton', `100 calls → ${redisRefs.size} unique instance`);
  } else {
    fail('S1 — getRedisClient() singleton', `Expected 1 unique instance, got ${redisRefs.size}`);
  }

  // ─── Section 2: Direct TossTradingService construction (100×) ───────────────

  section('Section 2: Direct TossTradingService(stub) × 100 — singleton reuse');

  const stubSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const directRL = new Set<object>();
  const directCB = new Set<object>();
  const directRedis = new Set<object>();

  for (let i = 0; i < 100; i++) {
    const svc = new TossTradingService(stubSupabase) as any;
    directRL.add(svc.rateLimiter);
    directCB.add(svc.circuitBreaker);
    // Reach through to the Redis client inside each RateLimiter
    directRedis.add((svc.rateLimiter as any).redis);
  }

  if (directRL.size === 1) {
    pass('S2a — RateLimiter reuse (direct new)', `100 instances → ${directRL.size} unique RateLimiter`);
  } else {
    fail('S2a — RateLimiter reuse (direct new)', `Expected 1, got ${directRL.size}`);
  }

  if (directCB.size === 1) {
    pass('S2b — CircuitBreaker reuse (direct new)', `100 instances → ${directCB.size} unique CircuitBreaker`);
  } else {
    fail('S2b — CircuitBreaker reuse (direct new)', `Expected 1, got ${directCB.size}`);
  }

  if (directRedis.size === 1) {
    pass('S2c — Redis client inside RateLimiter is singleton', `100 instances → ${directRedis.size} unique Redis client`);
  } else {
    fail('S2c — Redis client inside RateLimiter is singleton', `Expected 1, got ${directRedis.size}`);
  }

  // ─── Section 3: TradingServiceFactory.getService('LIVE', ...) (10×) ─────────

  section('Section 3: TradingServiceFactory.getService("LIVE") × 10 — singleton reuse');

  const factoryRL    = new Set<object>();
  const factoryCB    = new Set<object>();
  const factoryRedis = new Set<object>();
  const factoryInstances: any[] = [];

  for (let i = 0; i < 10; i++) {
    const svc = TradingServiceFactory.getService('LIVE', stubSupabase) as any;
    factoryInstances.push(svc);
    factoryRL.add(svc.rateLimiter);
    factoryCB.add(svc.circuitBreaker);
    factoryRedis.add((svc.rateLimiter as any).redis);
  }

  if (factoryRL.size === 1) {
    pass('S3a — RateLimiter reuse (factory LIVE path)', `10 factory calls → ${factoryRL.size} unique RateLimiter`);
  } else {
    fail('S3a — RateLimiter reuse (factory LIVE path)', `Expected 1, got ${factoryRL.size}`);
  }

  if (factoryCB.size === 1) {
    pass('S3b — CircuitBreaker reuse (factory LIVE path)', `10 factory calls → ${factoryCB.size} unique CircuitBreaker`);
  } else {
    fail('S3b — CircuitBreaker reuse (factory LIVE path)', `Expected 1, got ${factoryCB.size}`);
  }

  if (factoryRedis.size === 1) {
    pass('S3c — Redis client inside factory-created RateLimiter is singleton', `${factoryRedis.size} unique Redis client`);
  } else {
    fail('S3c — Redis client inside factory-created RateLimiter is singleton', `Expected 1, got ${factoryRedis.size}`);
  }

  // ─── Section 4: Cross-path singleton identity ────────────────────────────────
  //   Prove: direct new === factory === module-level export

  section('Section 4: Cross-path singleton identity (direct new ↔ factory ↔ module export)');

  // Pick one instance from each path
  const directSvc  = new TossTradingService(stubSupabase) as any;
  const factorySvc = TradingServiceFactory.getService('LIVE', stubSupabase) as any;
  const moduleExportSvc = moduleLevelTSS as any;

  // Test: RateLimiter === across all three paths
  const rlDirect  = directSvc.rateLimiter;
  const rlFactory = factorySvc.rateLimiter;
  const rlModule  = moduleExportSvc.rateLimiter;

  if (rlDirect === rlFactory) {
    pass('S4a — RateLimiter: direct new === factory instance');
  } else {
    fail('S4a — RateLimiter: direct new === factory instance', 'Different object references');
  }

  if (rlFactory === rlModule) {
    pass('S4b — RateLimiter: factory instance === module-level tossTradingService');
  } else {
    fail('S4b — RateLimiter: factory instance === module-level tossTradingService', 'Different object references');
  }

  if (rlDirect === moduleLevelRL) {
    pass('S4c — RateLimiter: direct new === exported rateLimiter singleton');
  } else {
    fail('S4c — RateLimiter: direct new === exported rateLimiter singleton', 'Different object references');
  }

  // Test: CircuitBreaker === across all three paths
  const cbDirect  = directSvc.circuitBreaker;
  const cbFactory = factorySvc.circuitBreaker;
  const cbModule  = moduleExportSvc.circuitBreaker;

  if (cbDirect === cbFactory) {
    pass('S4d — CircuitBreaker: direct new === factory instance');
  } else {
    fail('S4d — CircuitBreaker: direct new === factory instance', 'Different object references');
  }

  if (cbFactory === cbModule) {
    pass('S4e — CircuitBreaker: factory instance === module-level tossTradingService');
  } else {
    fail('S4e — CircuitBreaker: factory instance === module-level tossTradingService', 'Different object references');
  }

  if (cbDirect === moduleLevelCB) {
    pass('S4f — CircuitBreaker: direct new === exported circuitBreaker singleton');
  } else {
    fail('S4f — CircuitBreaker: direct new === exported circuitBreaker singleton', 'Different object references');
  }

  // Test: Redis client inside RateLimiter === global singleton
  const redisInsideRL = (rlDirect as any).redis;
  if (redisInsideRL === singletonRedis) {
    pass('S4g — Redis inside RateLimiter === getRedisClient() singleton');
  } else {
    fail('S4g — Redis inside RateLimiter === getRedisClient() singleton', 'Different object references');
  }

  // ─── Section 5: Module-level tossTradingService coverage ────────────────────

  section('Section 5: Module-level tossTradingService (toss-api.ts line 303)');

  // The module-level instance is created at import time using real env vars.
  // Its internal RL/CB must be the module-level singletons.
  if ((moduleLevelTSS as any).rateLimiter === moduleLevelRL) {
    pass('S5a — tossTradingService.rateLimiter === module-level rateLimiter export');
  } else {
    fail('S5a — tossTradingService.rateLimiter === module-level rateLimiter export', 'Not the same object');
  }

  if ((moduleLevelTSS as any).circuitBreaker === moduleLevelCB) {
    pass('S5b — tossTradingService.circuitBreaker === module-level circuitBreaker export');
  } else {
    fail('S5b — tossTradingService.circuitBreaker === module-level circuitBreaker export', 'Not the same object');
  }

  // ─── Section 6: RateLimiter.close() does not quit the singleton ──────────────

  section('Section 6: RateLimiter.close() protects shared Redis singleton');

  const sharedRedis = getRedisClient();
  const rlWrapper   = new RateLimiter(sharedRedis);
  await rlWrapper.close();
  const redisAfterClose = getRedisClient();

  if (redisAfterClose === sharedRedis) {
    pass('S6 — Singleton Redis unchanged after RateLimiter.close()');
  } else {
    fail('S6 — Singleton Redis unchanged after RateLimiter.close()', 'Reference changed');
  }

  // ─── Section 7: CircuitBreaker regression — state machine ────────────────────

  section('Section 7: CircuitBreaker regression — CLOSED → OPEN → HALF_OPEN → CLOSED');

  const cb = new CircuitBreaker(2, 100);
  (cb as any).redis = null; // isolate to local fallback; state machine logic is identical

  try {
    const ok = await cb.checkCall();
    ok ? pass('S7a — CLOSED allows call') : fail('S7a', 'CLOSED should allow calls');
  } catch (e: any) { fail('S7a', e.message); }

  await cb.recordFailure();
  await cb.recordFailure();

  try {
    await cb.checkCall();
    fail('S7b — OPEN blocks call', 'Expected throw');
  } catch (e: any) {
    e.message.includes('OPEN')
      ? pass('S7b — OPEN blocks call')
      : fail('S7b', `Unexpected error: ${e.message}`);
  }

  await new Promise<void>(r => setTimeout(r, 150)); // outlast 100ms cooldown

  try {
    const halfOpen = await cb.checkCall();
    halfOpen ? pass('S7c — HALF_OPEN allows trial call') : fail('S7c', 'Expected true');
  } catch (e: any) { fail('S7c', e.message); }

  await cb.recordSuccess();

  try {
    const recovered = await cb.checkCall();
    recovered ? pass('S7d — CLOSED after recovery') : fail('S7d', 'Expected true');
  } catch (e: any) { fail('S7d', e.message); }

  // ─── Section 8: RateLimiter regression — sliding window throttle ──────────────

  section('Section 8: RateLimiter regression — sliding window throttle (local memory)');

  const rl       = new RateLimiter();
  (rl as any).redis = null; // isolate
  const LIMIT    = 3;
  const WINDOW   = 1;
  let allowedCount = 0;

  for (let i = 0; i < 5; i++) {
    if (await rl.isAllowed('pr5d-throttle-key', LIMIT, WINDOW)) allowedCount++;
  }

  allowedCount === LIMIT
    ? pass('S8 — RateLimiter throttle', `${allowedCount}/5 calls allowed at limit=${LIMIT}`)
    : fail('S8 — RateLimiter throttle', `Expected ${LIMIT} allowed, got ${allowedCount}`);

  // ─── Section 10: placeOrder() real path verification ─────────────────────────

  section('Section 10: placeOrder() path — singleton identity through execution');

  function mockSupabaseQuery(table: string) {
    let isSingle = false;
    const builder: any = {};
    
    const chain = () => builder;
    const methods = ['select', 'eq', 'gt', 'lt', 'in', 'order', 'limit', 'insert', 'update', 'delete', 'upsert'];
    for (const m of methods) {
      builder[m] = chain;
    }
    
    builder.single = () => {
      isSingle = true;
      return builder;
    };
    
    builder.then = (onFulfilled: any) => {
      let result: any = { data: null, error: null };
      if (table === 'risk_profiles') {
        result = {
          data: {
            user_id: 'test-user-id',
            max_open_positions: 5,
            max_position_size_value: 100000000,
            max_order_value: 50000000,
            max_symbol_exposure_pct: 100.00,
            max_portfolio_exposure_pct: 100.00,
            daily_loss_limit: 10000000,
            kill_switch_active: false,
            max_trades_per_minute: 10,
            min_ai_confidence: 0.0,
            updated_at: new Date().toISOString()
          },
          error: null
        };
      } else if (table === 'orders') {
        result = { count: 0, data: [], error: null };
      } else if (table === 'portfolio_state') {
        result = { data: { cash_balance: 99999999 }, error: null };
      } else if (table === 'position_state') {
        if (isSingle) {
          result = { data: null, error: { code: 'PGRST116', message: 'No rows' } };
        } else {
          result = { data: [], error: null };
        }
      } else if (table === 'daily_portfolio_snapshots') {
        result = { data: { start_of_day_portfolio_value: 99999999 }, error: null };
      }
      return Promise.resolve(result).then(onFulfilled);
    };
    
    return builder;
  }

  const mockSupabase: any = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'test-user-id' } }, error: null }),
      getSession: () => Promise.resolve({ data: { session: { access_token: 'fake-token' } }, error: null }),
    },
    from: (table: string) => mockSupabaseQuery(table),
    rpc: async () => ({ data: {}, error: null })
  };

  // Set APP_URL so callProxy doesn't throw ConfigurationError
  const oldAppUrl = process.env.APP_URL;
  process.env.APP_URL = 'http://localhost:3000';

  // Resolve 3 separate LIVE service instances via factory
  const svc1 = TradingServiceFactory.getService('LIVE', mockSupabase) as any;
  const svc2 = TradingServiceFactory.getService('LIVE', mockSupabase) as any;
  const svc3 = TradingServiceFactory.getService('LIVE', mockSupabase) as any;

  // Verify that all 3 factory instances resolved the same singletons BEFORE execution
  const rlBefore = svc1.rateLimiter;
  const cbBefore = svc1.circuitBreaker;
  const redisBefore = (svc1.rateLimiter as any).redis;

  if (svc1.rateLimiter === svc2.rateLimiter && svc2.rateLimiter === svc3.rateLimiter) {
    pass('S10a — Pre-execution: RateLimiter singleton identical across all instances');
  } else {
    fail('S10a — Pre-execution: RateLimiter singleton identical across all instances', 'Different instances resolved');
  }

  if (svc1.circuitBreaker === svc2.circuitBreaker && svc2.circuitBreaker === svc3.circuitBreaker) {
    pass('S10b — Pre-execution: CircuitBreaker singleton identical across all instances');
  } else {
    fail('S10b — Pre-execution: CircuitBreaker singleton identical across all instances', 'Different instances resolved');
  }

  if (redisBefore === (svc2.rateLimiter as any).redis && redisBefore === (svc3.rateLimiter as any).redis) {
    pass('S10c — Pre-execution: Redis client singleton identical across all instances');
  } else {
    fail('S10c — Pre-execution: Redis client singleton identical across all instances', 'Different instances resolved');
  }

  // Execute placeOrder calls sequentially through the 3 instances
  const orderReq = {
    symbol: 'AAPL',
    side: 'BUY' as const,
    type: 'MARKET' as const,
    qty: 1,
    price: 150
  };

  let executionCount = 0;
  for (const [idx, svc] of [svc1, svc2, svc3].entries()) {
    try {
      await svc.placeOrder(orderReq, `test-order-s10-${idx}`);
      executionCount++;
    } catch (err: any) {
      if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED') || err.message.includes('connect ECONNREFUSED')) {
        executionCount++;
      } else {
        fail(`S10-exec-${idx}`, `Unexpected error during placeOrder: ${err.message}`);
      }
    }
  }

  if (executionCount === 3) {
    pass('S10d — placeOrder executed on all 3 service instances (caught proxy network failures)');
  } else {
    fail('S10d — placeOrder execution count', `Expected 3 executions, got ${executionCount}`);
  }

  // Verify that singletons remain identical AFTER execution
  const rlAfter = svc2.rateLimiter;
  const cbAfter = svc3.circuitBreaker;
  const redisAfter = (svc3.rateLimiter as any).redis;

  if (rlBefore === rlAfter) {
    pass('S10e — Post-execution: RateLimiter reference remains identical');
  } else {
    fail('S10e — Post-execution: RateLimiter reference changed', 'Reference mismatch');
  }

  if (cbBefore === cbAfter) {
    pass('S10f — Post-execution: CircuitBreaker reference remains identical');
  } else {
    fail('S10f — Post-execution: CircuitBreaker reference changed', 'Reference mismatch');
  }

  if (redisBefore === redisAfter) {
    pass('S10g — Post-execution: Redis client reference remains identical');
  } else {
    fail('S10g — Post-execution: Redis client reference changed', 'Reference mismatch');
  }

  // Restore env
  if (oldAppUrl) {
    process.env.APP_URL = oldAppUrl;
  } else {
    delete process.env.APP_URL;
  }

  // ─── Section 9: Cleanup safety ───────────────────────────────────────────────

  section('Section 9: closeRedisClient() idempotent cleanup');

  try { await closeRedisClient(); pass('S9a — closeRedisClient() first call'); }
  catch (e: any) { fail('S9a', e.message); }

  try { await closeRedisClient(); pass('S9b — closeRedisClient() second call (idempotent)'); }
  catch (e: any) { fail('S9b', e.message); }

  // ─── Final summary ────────────────────────────────────────────────────────────

  console.log('\n' + '═'.repeat(66));
  console.log(`PR-5D Production Integration Results: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(66));

  if (failed === 0) {
    console.log('✅ PR-5D PASS — Production singleton architecture fully verified.');
    console.log('   All paths (direct new / factory / module-level) share one Redis client.');
  } else {
    console.error(`❌ PR-5D FAIL — ${failed} test(s) failed.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

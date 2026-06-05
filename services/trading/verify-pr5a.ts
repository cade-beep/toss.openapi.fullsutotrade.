/* eslint-disable */
import { TossTradingService } from './toss-api';
import { RiskEngine } from '../risk/risk-engine';
import { createClient } from '@supabase/supabase-js';

// Setup environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key-12345';
process.env.APP_URL = 'http://localhost:3000';

class MockQueryBuilder {
  private table: string;
  private userId: string;
  private mockOrders: any[];
  private isCount: boolean = false;

  constructor(table: string, userId: string, mockOrders: any[]) {
    this.table = table;
    this.userId = userId;
    this.mockOrders = mockOrders;
  }

  select(cols?: string, options?: any) {
    if (options?.count === 'exact') {
      this.isCount = true;
    }
    return this;
  }

  eq(col: string, val: any) {
    return this;
  }

  gt(col: string, val: any) {
    return this;
  }

  in(col: string, vals: any[]) {
    return this;
  }

  async single() {
    if (this.table === 'risk_profiles') {
      return {
        data: {
          user_id: this.userId,
          max_open_positions: 5,
          max_position_size_value: 10000000,
          max_order_value: 5000000, // order limit is 5M KRW
          max_symbol_exposure_pct: 30.00,
          max_portfolio_exposure_pct: 100.00,
          daily_loss_limit: 1000000,
          kill_switch_active: false,
          max_trades_per_minute: 10,
          min_ai_confidence: 0.70,
          updated_at: new Date().toISOString()
        },
        error: null
      };
    }
    if (this.table === 'portfolio_state') {
      return {
        data: { cash_balance: 100000000 }, // 100M KRW
        error: null
      };
    }
    return { data: null, error: { code: 'PGRST116', message: 'Not found' } };
  }

  async insert(payload: any) {
    if (this.table === 'orders') {
      if (Array.isArray(payload)) {
        this.mockOrders.push(...payload);
      } else {
        this.mockOrders.push(payload);
      }
    }
    return { error: null };
  }

  update(updates: any) {
    return {
      eq: async (col: string, val: any) => {
        if (this.table === 'orders') {
          const order = this.mockOrders.find((o: any) => o[col] === val);
          if (order) {
            Object.assign(order, updates);
          }
        }
        return { error: null };
      }
    };
  }

  // Implement Thenable so that 'await queryBuilder' resolves cleanly
  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    const result = {
      count: this.isCount ? 0 : null,
      data: this.isCount ? null : [],
      error: null
    };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

function createMockSupabase(userId: string = 'test-user-123') {
  const mockOrders: any[] = [];
  let proxyCalled = false;
  let proxyPayload: any = null;

  // Mock fetch globally to catch the proxy call
  const originalFetch = global.fetch;
  global.fetch = async (url: any, options: any) => {
    if (url.toString().includes('/api/toss-proxy')) {
      proxyCalled = true;
      proxyPayload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ success: true, broker_order_id: 'BROKER-LIVE-123' })
      } as any;
    }
    return { ok: false } as any;
  };

  const client: any = {
    auth: {
      getUser: async () => ({
        data: { user: { id: userId, email: 'test@example.com' } },
        error: null
      }),
      getSession: async () => ({
        data: { session: { access_token: 'mock-access-token' } },
        error: null
      })
    },
    from: (table: string) => {
      return new MockQueryBuilder(table, userId, mockOrders);
    },
    _getMockOrders: () => mockOrders,
    _getProxyCalled: () => proxyCalled,
    _getProxyPayload: () => proxyPayload,
    _resetProxy: () => {
      proxyCalled = false;
      proxyPayload = null;
    },
    _restoreFetch: () => {
      global.fetch = originalFetch;
    }
  };

  return client;
}

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING PR-5A RISK ENGINE ENFORCEMENT TEST");
  console.log("=========================================");

  // Test 1: Valid Live Order
  {
    console.log("\n[Test 1] Executing order that satisfies risk limits...");
    const mockSupabase = createMockSupabase();
    const riskEngine = new RiskEngine(mockSupabase);
    const service = new TossTradingService(mockSupabase, riskEngine);

    const res = await service.placeOrder({
      symbol: '005930', // Samsung Electronics
      side: 'BUY',
      type: 'LIMIT',
      qty: 10,
      price: 70000 // 700,000 KRW order value (below 5M limit)
    });

    const mockOrders = mockSupabase._getMockOrders();
    const proxyCalled = mockSupabase._getProxyCalled();

    if (!res.success) {
      console.error("❌ Test 1 Failed: Order placement rejected:", res.error);
      process.exit(1);
    }

    if (mockOrders.length !== 1) {
      console.error("❌ Test 1 Failed: Expected exactly 1 order row in DB, found:", mockOrders.length);
      process.exit(1);
    }

    if (mockOrders[0].status !== 'PENDING') {
      console.error("❌ Test 1 Failed: Expected initial order status PENDING, got:", mockOrders[0].status);
      process.exit(1);
    }

    if (!proxyCalled) {
      console.error("❌ Test 1 Failed: Toss proxy was not called for valid order.");
      process.exit(1);
    }

    console.log("✅ Test 1 Passed: Order accepted, persisted as PENDING, and sent to broker.");
    mockSupabase._restoreFetch();
  }

  // Test 2: Invalid Live Order (Fails Risk Engine)
  {
    console.log("\n[Test 2] Executing order that violates risk limit (exceeds max order size)...");
    const mockSupabase = createMockSupabase();
    const riskEngine = new RiskEngine(mockSupabase);
    const service = new TossTradingService(mockSupabase, riskEngine);

    const res = await service.placeOrder({
      symbol: '005930',
      side: 'BUY',
      type: 'LIMIT',
      qty: 100,
      price: 70000 // 7,000,000 KRW order value (above 5M limit)
    });

    const mockOrders = mockSupabase._getMockOrders();
    const proxyCalled = mockSupabase._getProxyCalled();

    if (res.success) {
      console.error("❌ Test 2 Failed: Order should have been rejected by risk engine.");
      process.exit(1);
    }

    if (!res.error?.includes('exceeds maximum order size limit')) {
      console.error("❌ Test 2 Failed: Incorrect error message:", res.error);
      process.exit(1);
    }

    if (mockOrders.length !== 1) {
      console.error("❌ Test 2 Failed: Expected exactly 1 order row (the rejected trace) in DB, found:", mockOrders.length);
      process.exit(1);
    }

    if (mockOrders[0].status !== 'REJECTED') {
      console.error("❌ Test 2 Failed: Expected persisted order status to be REJECTED, got:", mockOrders[0].status);
      process.exit(1);
    }

    if (!mockOrders[0].error_message?.includes('exceeds maximum order size limit')) {
      console.error("❌ Test 2 Failed: DB error message trace missing or incorrect:", mockOrders[0].error_message);
      process.exit(1);
    }

    if (proxyCalled) {
      console.error("❌ Test 2 Failed: Toss proxy was called for an invalid order!");
      process.exit(1);
    }

    console.log("✅ Test 2 Passed: Rejected order directly logged as REJECTED, proxy bypassed.");
    mockSupabase._restoreFetch();
  }

  // Test 3: Invalid Live Order (Quantity <= 0)
  {
    console.log("\n[Test 3] Executing order that violates risk limit (quantity <= 0)...");
    const mockSupabase = createMockSupabase();
    const riskEngine = new RiskEngine(mockSupabase);
    const service = new TossTradingService(mockSupabase, riskEngine);

    const res = await service.placeOrder({
      symbol: '005930',
      side: 'BUY',
      type: 'LIMIT',
      qty: 0,
      price: 70000
    });

    const mockOrders = mockSupabase._getMockOrders();
    const proxyCalled = mockSupabase._getProxyCalled();

    if (res.success) {
      console.error("❌ Test 3 Failed: Order should have been rejected by risk engine (qty <= 0).");
      process.exit(1);
    }

    if (proxyCalled) {
      console.error("❌ Test 3 Failed: Toss proxy was called for qty <= 0 order!");
      process.exit(1);
    }

    if (mockOrders.length !== 1 || mockOrders[0].status !== 'REJECTED') {
      console.error("❌ Test 3 Failed: Audit trace not correctly persisted.");
      process.exit(1);
    }

    console.log("✅ Test 3 Passed: Rejected order (qty <= 0) directly logged as REJECTED, proxy bypassed.");
    mockSupabase._restoreFetch();
  }

  console.log("\n=========================================");
  console.log("PR-5A ALL VERIFICATION TESTS PASSED SUCCESSFULLY");
  console.log("=========================================");
}

runTests().catch(err => {
  console.error("❌ Exception occurred during verify-pr5a tests:", err);
  process.exit(1);
});

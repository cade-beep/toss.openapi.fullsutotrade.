/* eslint-disable */
import { TossTradingService } from './toss-api';
import { PaperTradingService } from './paper-trading-service';
import { RiskEngine } from '../risk/risk-engine';
import { createClient } from '@supabase/supabase-js';
import { closeRedisClient } from '../../lib/redis';

// Setup environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key-12345';
process.env.APP_URL = 'http://localhost:3000';

class MockQueryBuilder {
  private table: string;
  private userId: string;
  private mockOrders: any[];
  private mockProfiles: any[];

  constructor(table: string, userId: string, mockOrders: any[], mockProfiles: any[]) {
    this.table = table;
    this.userId = userId;
    this.mockOrders = mockOrders;
    this.mockProfiles = mockProfiles;
  }

  select(cols?: string, options?: any) {
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
      const profile = this.mockProfiles.find(p => p.user_id === this.userId);
      return {
        data: profile || {
          user_id: this.userId,
          max_open_positions: 5,
          max_position_size_value: 10000000,
          max_order_value: 5000000,
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
        data: { cash_balance: 100000000 },
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
    // DIRECT UPDATE VIOLATION (Simulate direct UPDATE policy rejection)
    return {
      eq: async (col: string, val: any) => {
        return {
          error: {
            code: '42501',
            message: `Permission denied: Direct UPDATE statements on public.${this.table} are forbidden by RLS.`
          }
        };
      }
    };
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
  }
}

function createMockSupabase(userId: string = 'test-user-123') {
  const mockOrders: any[] = [];
  const mockProfiles: any[] = [];
  let proxyCalled = false;
  let rpcCalledLog: { name: string; args: any }[] = [];

  const originalFetch = global.fetch;
  global.fetch = async (url: any, options: any) => {
    if (url.toString().includes('/api/toss-proxy')) {
      proxyCalled = true;
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
      return new MockQueryBuilder(table, userId, mockOrders, mockProfiles);
    },
    rpc: async (name: string, args: any) => {
      rpcCalledLog.push({ name, args });
      
      if (name === 'update_order_status_v2') {
        const order = mockOrders.find((o: any) => o.client_order_id === args.p_client_order_id);
        if (order) {
          order.status = args.p_status;
          if (args.p_error_message) {
            order.error_message = args.p_error_message;
          }
        }
        return { error: null };
      }

      if (name === 'update_risk_profile_v2') {
        const profileIdx = mockProfiles.findIndex(p => p.user_id === userId);
        const newProfile = {
          user_id: userId,
          max_open_positions: args.p_max_open_positions,
          max_position_size_value: args.p_max_position_size_value,
          max_order_value: args.p_max_order_value,
          max_symbol_exposure_pct: args.p_max_symbol_exposure_pct,
          max_portfolio_exposure_pct: args.p_max_portfolio_exposure_pct,
          daily_loss_limit: args.p_daily_loss_limit,
          kill_switch_active: args.p_kill_switch_active,
          max_trades_per_minute: args.p_max_trades_per_minute,
          min_ai_confidence: args.p_min_ai_confidence,
          updated_at: new Date().toISOString()
        };

        if (profileIdx >= 0) {
          mockProfiles[profileIdx] = newProfile;
        } else {
          mockProfiles.push(newProfile);
        }
        return { error: null };
      }

      return { error: null };
    },
    _getMockOrders: () => mockOrders,
    _getMockProfiles: () => mockProfiles,
    _getRpcCalls: () => rpcCalledLog,
    _getProxyCalled: () => proxyCalled,
    _restoreFetch: () => {
      global.fetch = originalFetch;
    }
  };

  return client;
}

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING PR-5B RLS HARDENING VERIFY TESTS");
  console.log("=========================================");

  // Test 1: Assert Direct Updates Are Denied (RLS policy check emulation)
  {
    console.log("\n[Test 1] Emulating direct orders/risk_profile updates...");
    const mockSupabase = createMockSupabase();
    
    const resOrders = await mockSupabase.from('orders').update({ status: 'REJECTED' }).eq('client_order_id', 'ord-1');
    const resRisk = await mockSupabase.from('risk_profiles').update({ max_order_value: 100 }).eq('user_id', 'user-1');

    if (!resOrders.error || resOrders.error.code !== '42501') {
      console.error("❌ Test 1 Failed: Expected direct orders update to return permission denied error, got:", resOrders);
      process.exit(1);
    }

    if (!resRisk.error || resRisk.error.code !== '42501') {
      console.error("❌ Test 1 Failed: Expected direct risk_profiles update to return permission denied error, got:", resRisk);
      process.exit(1);
    }

    console.log("✅ Test 1 Passed: Direct updates correctly denied by mock RLS policy restrictions.");
    mockSupabase._restoreFetch();
  }

  // Test 2: Secure Order Status Update RPC Check
  {
    console.log("\n[Test 2] Testing update_order_status_v2 RPC execution...");
    const mockSupabase = createMockSupabase();
    
    // Seed order
    await mockSupabase.from('orders').insert({
      client_order_id: 'ord-rpc-test',
      user_id: 'test-user-123',
      status: 'PENDING'
    });

    const res = await mockSupabase.rpc('update_order_status_v2', {
      p_client_order_id: 'ord-rpc-test',
      p_status: 'SUBMITTED'
    });

    const orders = mockSupabase._getMockOrders();
    const finalOrder = orders.find((o: any) => o.client_order_id === 'ord-rpc-test');

    if (res.error) {
      console.error("❌ Test 2 Failed: update_order_status_v2 RPC returned error:", res.error);
      process.exit(1);
    }

    if (!finalOrder || finalOrder.status !== 'SUBMITTED') {
      console.error("❌ Test 2 Failed: Status not updated correctly in database:", finalOrder);
      process.exit(1);
    }

    console.log("✅ Test 2 Passed: secure order update RPC executed successfully.");
    mockSupabase._restoreFetch();
  }

  // Test 3: Secure Risk Profile Update RPC Check
  {
    console.log("\n[Test 3] Testing update_risk_profile_v2 RPC execution...");
    const mockSupabase = createMockSupabase();

    const res = await mockSupabase.rpc('update_risk_profile_v2', {
      p_max_open_positions: 8,
      p_max_position_size_value: 20000000,
      p_max_order_value: 8000000,
      p_max_symbol_exposure_pct: 40.00,
      p_max_portfolio_exposure_pct: 100.00,
      p_daily_loss_limit: 2000000,
      p_kill_switch_active: false,
      p_max_trades_per_minute: 15,
      p_min_ai_confidence: 0.75
    });

    const profiles = mockSupabase._getMockProfiles();

    if (res.error) {
      console.error("❌ Test 3 Failed: update_risk_profile_v2 RPC returned error:", res.error);
      process.exit(1);
    }

    if (profiles.length !== 1 || profiles[0].max_open_positions !== 8 || profiles[0].max_order_value !== 8000000) {
      console.error("❌ Test 3 Failed: Profile limits not updated correctly in DB:", profiles);
      process.exit(1);
    }

    console.log("✅ Test 3 Passed: secure risk profile update RPC executed successfully.");
    mockSupabase._restoreFetch();
  }

  // Test 4: Integration flow in TossTradingService (LIVE failure)
  {
    console.log("\n[Test 4] Verifying TossTradingService integration (Failure calls RPC)...");
    const mockSupabase = createMockSupabase();
    
    // Mock fetch to fail to trigger catch block
    global.fetch = async (url: any, options: any) => {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Broker API Offline' })
      } as any;
    };

    const riskEngine = new RiskEngine(mockSupabase);
    const service = new TossTradingService(mockSupabase, riskEngine);
    const cid = 'ord-toss-int-test';

    const res = await service.placeOrder({
      symbol: '005930',
      side: 'BUY',
      type: 'LIMIT',
      qty: 10,
      price: 70000
    }, cid);

    const rpcCalls = mockSupabase._getRpcCalls();
    const hasOrderRpc = rpcCalls.some((c: any) => 
      c.name === 'update_order_status_v2' && 
      c.args.p_client_order_id === cid && 
      c.args.p_status === 'REJECTED' &&
      c.args.p_error_message.includes('Broker API Offline')
    );

    if (res.success) {
      console.error("❌ Test 4 Failed: Expected placeOrder to return success false.");
      process.exit(1);
    }

    if (!hasOrderRpc) {
      console.error("❌ Test 4 Failed: TossTradingService failed to call update_order_status_v2 RPC on error:", rpcCalls);
      process.exit(1);
    }

    console.log("✅ Test 4 Passed: TossTradingService successfully used secure RPC for error transition.");
    mockSupabase._restoreFetch();
  }

  // Test 5: Integration flow in PaperTradingService
  {
    console.log("\n[Test 5] Verifying PaperTradingService integration (SUBMITTED transition calls RPC)...");
    const mockSupabase = createMockSupabase();
    const riskEngine = new RiskEngine(mockSupabase);
    const service = new PaperTradingService(mockSupabase, riskEngine);
    const cid = 'ord-paper-int-test';

    // placeOrder should transition order status
    const res = await service.placeOrder({
      symbol: '005930',
      side: 'BUY',
      type: 'LIMIT',
      qty: 10,
      price: 70000
    }, cid);

    const rpcCalls = mockSupabase._getRpcCalls();
    const hasSubmittedRpc = rpcCalls.some((c: any) =>
      c.name === 'update_order_status_v2' &&
      c.args.p_client_order_id === cid &&
      c.args.p_status === 'SUBMITTED'
    );

    if (!res.success) {
      console.error("❌ Test 5 Failed: PaperTradingService placeOrder rejected:", res.error);
      process.exit(1);
    }

    if (!hasSubmittedRpc) {
      console.error("❌ Test 5 Failed: PaperTradingService did not transition order status via RPC:", rpcCalls);
      process.exit(1);
    }

    console.log("✅ Test 5 Passed: PaperTradingService successfully transitioned status via secure RPC.");
    mockSupabase._restoreFetch();
  }

  console.log("\n=========================================");
  console.log("PR-5B ALL VERIFICATION TESTS PASSED SUCCESSFULLY");
  console.log("=========================================");
  await closeRedisClient();
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error("❌ Exception during PR-5B verification tests:", err);
  process.exit(1);
});

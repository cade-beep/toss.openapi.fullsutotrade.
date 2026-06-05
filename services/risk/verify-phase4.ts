import { RiskEngine } from './risk-engine';
import { TradeIntent } from '../../types/strategy';
import { MockMarketDataProvider } from '../market/mock-market-data-provider';

// Mock Supabase Client Generator for stateless unit tests
function createMockSupabase(mockData: any): any {
  const queryResult = (table: string, filters: Record<string, any> = {}) => {
    if (table === 'risk_profiles') {
      return { data: mockData.risk_profile, error: null };
    }
    if (table === 'portfolio_state') {
      return { data: mockData.portfolio_state, error: null };
    }
    if (table === 'position_state') {
      if (filters.symbol) {
        const found = mockData.position_state?.find((p: any) => p.symbol === filters.symbol);
        return { data: found || null, error: null };
      }
      return { data: mockData.position_state || [], error: null };
    }
    if (table === 'daily_portfolio_snapshots') {
      return { 
        data: mockData.daily_snapshot, 
        error: mockData.daily_snapshot ? null : { code: 'PGRST116' } 
      };
    }
    if (table === 'orders') {
      return { data: [], error: null };
    }
    return { data: null, error: null };
  };

  const chain: any = {
    select: (cols: string, options: any = {}) => chain,
    eq: (col: string, val: any) => {
      chain.filters[col] = val;
      return chain;
    },
    gt: (col: string, val: any) => {
      chain.filters[col + '_gt'] = val;
      return chain;
    },
    in: (col: string, val: any) => {
      chain.filters[col + '_in'] = val;
      return chain;
    },
    single: async () => queryResult(chain.table, chain.filters),
    insert: (payload: any) => {
      return {
        then: (onfulfilled?: (value: any) => any) => {
          return Promise.resolve(onfulfilled?.({ error: null }));
        }
      };
    },
    then: (onfulfilled?: (value: any) => any) => {
      const res = queryResult(chain.table, chain.filters);
      const countVal = (chain.table === 'orders') ? (mockData.orders_count ?? 0) : null;
      return Promise.resolve(onfulfilled?.({ count: countVal, data: res.data, error: res.error }));
    }
  };

  const mock = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'test-user-id' } }, error: null })
    },
    from: (table: string) => {
      chain.table = table;
      chain.filters = {};
      return chain;
    }
  };
  return mock;
}

// Custom mock market data provider that returns constant prices for deterministic testing
class FixedMarketDataProvider extends MockMarketDataProvider {
  async getPrice(symbol: string): Promise<number> {
    if (symbol === 'AAPL') return 150000;
    if (symbol === 'TSLA') return 200000;
    return 100000;
  }
}

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING RISK ENGINE 10 RULES VERIFICATION");
  console.log("=========================================");

  const marketData = new FixedMarketDataProvider();

  // Test 1: Emergency Kill Switch
  {
    const mockDb = createMockSupabase({
      risk_profile: { kill_switch_active: true },
      position_state: [
        { symbol: 'AAPL', qty: 10 }
      ]
    });
    const riskEngine = new RiskEngine(mockDb, marketData);
    const intent: TradeIntent = {
      symbol: 'AAPL',
      side: 'BUY',
      type: 'LIMIT',
      qty: 1,
      price: 150000,
      clientOrderId: 'T1'
    };

    const res = await riskEngine.validate(intent, 'user-1');
    console.log("Rule 1 (Kill Switch BUY):", !res.isValid && res.rejectionReason?.includes('halted') ? "✅ PASS" : "❌ FAIL");

    const sellIntent: TradeIntent = { ...intent, side: 'SELL' };
    const sellRes = await riskEngine.validate(sellIntent, 'user-1');
    console.log("Rule 1 (Kill Switch SELL):", sellRes.isValid ? "✅ PASS" : "❌ FAIL");
  }

  // Test 2: Trade Frequency Limits
  {
    const mockDb = createMockSupabase({
      risk_profile: { max_trades_per_minute: 5 },
      orders_count: 6
    });
    const riskEngine = new RiskEngine(mockDb, marketData);
    const intent: TradeIntent = {
      symbol: 'AAPL',
      side: 'BUY',
      type: 'LIMIT',
      qty: 1,
      price: 150000,
      clientOrderId: 'T2'
    };

    const res = await riskEngine.validate(intent, 'user-1');
    console.log("Rule 2 (Rate Limiting):", !res.isValid && res.rejectionReason?.includes('frequency limit exceeded') ? "✅ PASS" : "❌ FAIL");
  }

  // Test 3: Max Order Size
  {
    const mockDb = createMockSupabase({
      risk_profile: { max_order_value: 1000000 } // 1,000,000 KRW max order
    });
    const riskEngine = new RiskEngine(mockDb, marketData);
    const intent: TradeIntent = {
      symbol: 'AAPL',
      side: 'BUY',
      type: 'LIMIT',
      qty: 10, // 10 * 150,000 = 1,500,000 KRW
      price: 150000,
      clientOrderId: 'T3'
    };

    const res = await riskEngine.validate(intent, 'user-1');
    console.log("Rule 3 (Max Order Size):", !res.isValid && res.rejectionReason?.includes('exceeds maximum order size') ? "✅ PASS" : "❌ FAIL");
  }

  // Test 4: AI Strategy Risk Controls
  {
    const mockDb = createMockSupabase({
      risk_profile: { min_ai_confidence: 0.80 }
    });
    const riskEngine = new RiskEngine(mockDb, marketData);
    const intent: TradeIntent = {
      symbol: 'AAPL',
      side: 'BUY',
      type: 'LIMIT',
      qty: 1,
      price: 150000,
      clientOrderId: 'T4',
      isAI: true,
      aiConfidence: 0.65
    };

    const res = await riskEngine.validate(intent, 'user-1');
    console.log("Rule 4 (AI Confidence):", !res.isValid && res.rejectionReason?.includes('confidence') ? "✅ PASS" : "❌ FAIL");
  }

  // Test 5: Position Limits
  {
    const mockDb = createMockSupabase({
      risk_profile: { max_open_positions: 2 },
      portfolio_state: { cash_balance: 10000000 },
      position_state: [
        { symbol: 'AAPL', qty: 10 },
        { symbol: 'TSLA', qty: 5 }
      ] // already 2 positions
    });
    const riskEngine = new RiskEngine(mockDb, marketData);
    const intent: TradeIntent = {
      symbol: 'SPY', // opening a 3rd symbol position
      side: 'BUY',
      type: 'LIMIT',
      qty: 1,
      price: 100000,
      clientOrderId: 'T5'
    };

    const res = await riskEngine.validate(intent, 'user-1');
    console.log("Rule 5 (Position Limits):", !res.isValid && res.rejectionReason?.includes('Position limits exceeded') ? "✅ PASS" : "❌ FAIL");
  }

  // Test 6: Max Position Size
  {
    const mockDb = createMockSupabase({
      risk_profile: { max_position_size_value: 2000000 }, // 2M KRW limit
      portfolio_state: { cash_balance: 10000000 },
      position_state: [
        { symbol: 'AAPL', qty: 10 } // current value = 10 * 150,000 = 1,500,000
      ]
    });
    const riskEngine = new RiskEngine(mockDb, marketData);
    const intent: TradeIntent = {
      symbol: 'AAPL',
      side: 'BUY',
      type: 'LIMIT',
      qty: 5, // new value = 15 * 150,000 = 2,250,000 KRW
      price: 150000,
      clientOrderId: 'T6'
    };

    const res = await riskEngine.validate(intent, 'user-1');
    console.log("Rule 6 (Max Position Size):", !res.isValid && res.rejectionReason?.includes('exceeds maximum allowed position size') ? "✅ PASS" : "❌ FAIL");
  }

  // Test 7: Symbol Exposure Limits
  {
    const mockDb = createMockSupabase({
      risk_profile: { max_symbol_exposure_pct: 25.00 }, // 25% max exposure
      portfolio_state: { cash_balance: 1000000 }, // cash = 1,000,000
      position_state: [
        { symbol: 'AAPL', qty: 2 } // current value = 300,000. Total value = 1,300,000.
      ]
    });
    const riskEngine = new RiskEngine(mockDb, marketData);
    const intent: TradeIntent = {
      symbol: 'AAPL',
      side: 'BUY',
      type: 'LIMIT',
      qty: 1, // new qty = 3, value = 450,000. Total portfolio = 1,300,000. Exposure = 450/1300 = 34.6%.
      price: 150000,
      clientOrderId: 'T7'
    };

    const res = await riskEngine.validate(intent, 'user-1');
    console.log("Rule 7 (Symbol Exposure Limit):", !res.isValid && res.rejectionReason?.includes('Symbol exposure') ? "✅ PASS" : "❌ FAIL");
  }

  // Test 8: Portfolio Exposure Limits
  {
    const mockDb = createMockSupabase({
      risk_profile: { max_portfolio_exposure_pct: 50.00 }, // 50% max total position exposure
      portfolio_state: { cash_balance: 600000 },
      position_state: [
        { symbol: 'AAPL', qty: 2 }, // value = 300,000
        { symbol: 'TSLA', qty: 1 }  // value = 200,000. Total position value = 500,000. Total portfolio = 1,100,000.
      ]
    });
    const riskEngine = new RiskEngine(mockDb, marketData);
    const intent: TradeIntent = {
      symbol: 'AAPL',
      side: 'BUY',
      type: 'LIMIT',
      qty: 1, // total position value becomes 650,000. Total portfolio = 1,100,000. Position exposure = 650/1100 = 59%.
      price: 150000,
      clientOrderId: 'T8'
    };

    const res = await riskEngine.validate(intent, 'user-1');
    console.log("Rule 8 (Portfolio Exposure Limit):", !res.isValid && res.rejectionReason?.includes('Total portfolio exposure') ? "✅ PASS" : "❌ FAIL");
  }

  // Test 9: Daily Loss Limits
  {
    const mockDb = createMockSupabase({
      risk_profile: { daily_loss_limit: 100000 }, // 100,000 loss limit
      portfolio_state: { cash_balance: 1000000 }, // current total value = 1,000,000
      daily_snapshot: { start_of_day_portfolio_value: 1200000 } // day started at 1,200,000 (meaning current loss = 200,000)
    });
    const riskEngine = new RiskEngine(mockDb, marketData);
    const intent: TradeIntent = {
      symbol: 'AAPL',
      side: 'BUY',
      type: 'LIMIT',
      qty: 1,
      price: 150000,
      clientOrderId: 'T9'
    };

    const res = await riskEngine.validate(intent, 'user-1');
    console.log("Rule 9 (Daily Loss Limit):", !res.isValid && res.rejectionReason?.includes('Daily loss limit breached') ? "✅ PASS" : "❌ FAIL");
  }

  // Test 10: Broker-Independent Layer
  {
    const mockDb = createMockSupabase({
      risk_profile: { max_order_value: 5000000 },
      portfolio_state: { cash_balance: 10000000 }
    });
    const riskEngine = new RiskEngine(mockDb, marketData);
    const intent: TradeIntent = {
      symbol: 'AAPL',
      side: 'BUY',
      type: 'LIMIT',
      qty: 1,
      price: 150000,
      clientOrderId: 'T10'
    };

    const res = await riskEngine.validate(intent, 'user-1');
    console.log("Rule 10 (Valid pre-trade checks):", res.isValid ? "✅ PASS" : "❌ FAIL");
  }

  // Test 11: Concurrency Validation Check
  {
    const mockDb = createMockSupabase({
      risk_profile: { max_order_value: 10000000 },
      portfolio_state: { cash_balance: 10000000 }
    });

    const originalFrom = mockDb.from;
    mockDb.from = (table: string) => {
      if (table === 'orders') {
        const chain = {
          select: () => chain,
          eq: () => chain,
          gt: () => chain,
          in: () => chain,
          then: (onfulfilled: any) => Promise.resolve(onfulfilled({
            data: [
              { symbol: 'AAPL', side: 'BUY', qty: 66, filled_qty: 0, price: 150000 }
            ],
            error: null
          }))
        };
        return chain;
      }
      return originalFrom(table);
    };

    const riskEngine = new RiskEngine(mockDb, marketData);
    const intent: TradeIntent = {
      symbol: 'AAPL',
      side: 'BUY',
      type: 'LIMIT',
      qty: 1,
      price: 150000,
      clientOrderId: 'T11'
    };

    const res = await riskEngine.validate(intent, 'user-1');
    console.log("Rule 11 (Concurrency check):", !res.isValid && res.rejectionReason?.includes('including pending orders') ? "✅ PASS" : "❌ FAIL");
  }
}

runTests().catch(console.error);

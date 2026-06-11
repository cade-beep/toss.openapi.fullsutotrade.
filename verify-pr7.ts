/* eslint-disable */
import { CSVHistoricalDataProvider, HistoricalBar } from './services/market/historical-provider';
import { createBacktestSandboxDb } from './services/ai/backtest-sandbox';
import { BacktestMetricsCalculator, BacktestTrade } from './services/ai/metrics-calculator';
import { BacktestEngine, BacktestEngineRequest } from './services/ai/backtest-engine';
import { PaperTradingService } from './services/trading/paper-trading-service';
import { RiskEngine } from './services/risk/risk-engine';

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING PR-7 BACKTESTING SYSTEM VERIFICATION");
  console.log("=========================================");

  // --- Test 1: Historical Data Provider CSV Parsing ---
  {
    console.log('\n[Test 1] Verifying CSVHistoricalDataProvider parsing...');
    const csvData = `Date,Open,High,Low,Close,Volume
2026-06-01,70000,71000,69500,70500,100000
2026-06-02,70500,72000,70100,71500,120000
2026-06-03,71500,71800,69000,69500,150000
2026-06-04,69500,73000,69300,72500,200000`;

    const provider = new CSVHistoricalDataProvider(csvData);
    const bars = await provider.getHistoricalData('005930', '2026-06-01', '2026-06-04');

    console.log(`Parsed Bars Count: ${bars.length}`);
    if (
      bars.length === 4 && 
      bars[0].close === 70500 && 
      bars[1].high === 72000 && 
      bars[3].volume === 200000
    ) {
      console.log('Test 1: ✅ PASS');
    } else {
      console.log('Test 1: ❌ FAIL', bars);
      process.exit(1);
    }
  }

  // --- Test 2: Sandbox DB Isolation ---
  {
    console.log('\n[Test 2] Verifying Backtest Sandbox DB in-memory isolation...');
    const initialCapital = 50000000;
    const db = createBacktestSandboxDb(initialCapital);

    // Initial cash check
    const { data: initPort } = await db.from('portfolio_state').select('cash_balance').single();
    console.log(`Initial Cash Balance: ${initPort?.cash_balance}`);

    // Call execute_trade RPC on mock DB
    await db.rpc('execute_trade_v2', {
      p_execution_id: 'EXEC-TEST-123',
      p_client_order_id: 'ORD-TEST-123',
      p_fill_qty: 10,
      p_fill_price: 100000,
      p_sequence_number: 1,
      p_raw_payload: {}
    });

    // Mock an order insertion manually to check state
    await db.from('orders').insert({
      client_order_id: 'ORD-TEST-123',
      symbol: 'AAPL',
      side: 'BUY',
      qty: 10,
      price: 100000,
      status: 'PENDING'
    });

    await db.rpc('execute_trade_v2', {
      p_execution_id: 'EXEC-TEST-123',
      p_client_order_id: 'ORD-TEST-123',
      p_fill_qty: 10,
      p_fill_price: 100000,
      p_sequence_number: 1,
      p_raw_payload: {}
    });

    const { data: updatedPort } = await db.from('portfolio_state').select('cash_balance').single();
    const { data: positions } = await db.from('position_state').select('*');

    console.log(`Updated Cash Balance: ${updatedPort?.cash_balance}`);
    console.log(`Positions active:`, positions);

    const isIsolated = updatedPort?.cash_balance === 49000000 && 
                        positions && 
                        positions.length === 1 && 
                        positions[0].symbol === 'AAPL' && 
                        positions[0].qty === 10;

    if (isIsolated) {
      console.log('Test 2: ✅ PASS');
    } else {
      console.log('Test 2: ❌ FAIL', { updatedPort, positions });
      process.exit(1);
    }
  }

  // --- Test 3: Sandbox Risk Engine Checks ---
  {
    console.log('\n[Test 3] Verifying Risk Engine executes rules in Sandbox...');
    
    // Create risk profile setting max order value to 2,000,000 KRW
    const riskProfile = {
      max_open_positions: 5,
      max_position_size_value: 10000000,
      max_order_value: 2000000, // 2M limit
      max_symbol_exposure_pct: 100,
      max_portfolio_exposure_pct: 100,
      daily_loss_limit: 1000000,
      kill_switch_active: false,
      max_trades_per_minute: 100,
      min_ai_confidence: 0,
    };

    const initialCapital = 10000000;
    const sandboxDb = createBacktestSandboxDb(initialCapital, riskProfile);
    
    // Setup mock market data resolution
    class ConstantMarketData {
      async getPrice() { return 150000; }
    }
    const marketData = new ConstantMarketData() as any;
    const riskEngine = new RiskEngine(sandboxDb, marketData);
    const tradingService = new PaperTradingService(sandboxDb, riskEngine, marketData);

    // Place order within limits: 10 * 150,000 = 1.5M (< 2M max order limit)
    const order1 = await tradingService.placeOrder({
      symbol: 'AAPL',
      side: 'BUY',
      type: 'MARKET',
      qty: 10
    }, 'ORD-RISK-PASS');

    // Place order exceeding limits: 15 * 150,000 = 2.25M (> 2M max order limit)
    const order2 = await tradingService.placeOrder({
      symbol: 'AAPL',
      side: 'BUY',
      type: 'MARKET',
      qty: 15
    }, 'ORD-RISK-FAIL');

    console.log(`Order 1 within limits:`, order1.success);
    console.log(`Order 2 exceeding limits:`, order2.success, order2.error);

    if (order1.success && !order2.success && order2.error?.includes('exceeds maximum order size')) {
      console.log('Test 3: ✅ PASS');
    } else {
      console.log('Test 3: ❌ FAIL', { order1, order2 });
      process.exit(1);
    }
  }

  // --- Test 4: Backtest Performance Metrics Calculation ---
  {
    console.log('\n[Test 4] Verifying BacktestMetricsCalculator calculations...');
    const initialCapital = 10000000;
    
    const equityCurve = [
      { date: '2026-06-01', value: 10000000 },
      { date: '2026-06-02', value: 10200000 },
      { date: '2026-06-03', value: 9900000 },
      { date: '2026-06-04', value: 10500000 }
    ];

    const trades: BacktestTrade[] = [
      {
        date: '2026-06-01',
        symbol: 'AAPL',
        side: 'BUY',
        qty: 10,
        price: 100000,
        totalValue: 1000000
      },
      {
        date: '2026-06-02',
        symbol: 'AAPL',
        side: 'SELL',
        qty: 10,
        price: 120000,
        totalValue: 1200000
      },
      {
        date: '2026-06-03',
        symbol: 'AAPL',
        side: 'BUY',
        qty: 10,
        price: 120000,
        totalValue: 1200000
      },
      {
        date: '2026-06-04',
        symbol: 'AAPL',
        side: 'SELL',
        qty: 10,
        price: 110000,
        totalValue: 1100000
      }
    ];

    const metrics = BacktestMetricsCalculator.calculate(equityCurve, trades, initialCapital);
    console.log(`Calculated metrics:`, metrics);

    // Math Checks:
    // Profit 1: (120k - 100k) * 10 = +200k
    // Profit 2: (110k - 120k) * 10 = -100k
    // Win rate: 1/2 = 50%
    // Profit factor: 200k / 100k = 2.0
    // Total Return: (10.5M - 10M) / 10M = +5%
    // Max Drawdown: Peak was 10.2M, dropped to 9.9M => DD = (10.2 - 9.9) / 10.2 = ~2.94%

    const winRateCheck = metrics.winRate === 0.5;
    const profitFactorCheck = metrics.profitFactor === 2.0;
    const totalReturnCheck = metrics.totalReturn === 5.0;
    const mddCheck = Math.abs(metrics.maxDrawdown - 0.02941) < 0.001;

    if (winRateCheck && profitFactorCheck && totalReturnCheck && mddCheck) {
      console.log('Test 4: ✅ PASS');
    } else {
      console.log('Test 4: ❌ FAIL', { winRateCheck, profitFactorCheck, totalReturnCheck, mddCheck });
      process.exit(1);
    }
  }

  // --- Test 5: Full Backtest Engine Loop Run ---
  {
    console.log('\n[Test 5] Executing full BacktestEngine loop check...');
    const csvData = `Date,Open,High,Low,Close,Volume
2026-06-01,75000,76000,74500,75000,100000
2026-06-02,75000,75500,73500,74000,120000
2026-06-03,74000,74200,72800,73000,150000
2026-06-04,73000,73500,71500,72000,200000
2026-06-05,72000,72500,70500,71000,180000
2026-06-08,71000,72000,70800,71500,160000
2026-06-09,71500,73500,71200,73000,170000
2026-06-10,73000,75500,72800,75000,210000`;

    const provider = new CSVHistoricalDataProvider(csvData);
    const engine = new BacktestEngine();

    const request: BacktestEngineRequest = {
      strategyName: 'MA_CROSSOVER',
      symbol: '005930',
      startDate: '2026-06-01',
      endDate: '2026-06-10',
      initialCapital: 10000000,
      params: { fastPeriod: 2, slowPeriod: 4, orderSize: 10 },
      historicalProvider: provider
    };

    const res = await engine.runBacktest(request);
    console.log('Backtest Engine Success:', res.success);
    console.log('Backtest Trades Count:', res.trades.length);
    console.log('Final Equity Value:', res.equityCurve[res.equityCurve.length - 1]?.value);

    if (res.success && res.trades.length > 0 && res.equityCurve.length === 8) {
      console.log('Test 5: ✅ PASS');
    } else {
      console.log('Test 5: ❌ FAIL', res);
      process.exit(1);
    }
  }

  console.log("\n=========================================");
  console.log("PR-7 BACKTESTING SYSTEM VERIFIED SUCCESSFULLY!");
  console.log("=========================================");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

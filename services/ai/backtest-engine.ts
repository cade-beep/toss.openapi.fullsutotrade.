import { SupabaseClient } from '@supabase/supabase-js';
import { createBacktestSandboxDb } from './backtest-sandbox';
import { PaperTradingService } from '../trading/paper-trading-service';
import { RiskEngine } from '../risk/risk-engine';
import { MarketDataProvider, MarketDataCallback } from '../market/interface';
import { HistoricalDataProvider, HistoricalBar } from '../market/historical-provider';
import { BacktestMetricsCalculator, BacktestTrade } from './metrics-calculator';

export interface BacktestEngineRequest {
  strategyName: 'MA_CROSSOVER' | 'RSI_REVERSION';
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  params: Record<string, number>;
  historicalProvider: HistoricalDataProvider;
  riskProfile?: any;
}

export interface BacktestEngineResult {
  success: boolean;
  metrics: {
    totalReturn: number;
    cagr: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    sharpeRatio: number;
    totalTrades: number;
  };
  trades: BacktestTrade[];
  equityCurve: { date: string; value: number }[];
  error?: string;
}

// Custom sandboxed Market Data Provider for backtesting price resolution
class SandboxedMarketDataProvider implements MarketDataProvider {
  private currentPrice: number = 0;

  setPrice(price: number) {
    this.currentPrice = price;
  }

  async getPrice(symbol: string): Promise<number> {
    return this.currentPrice;
  }

  subscribe(symbol: string, callback: MarketDataCallback): void {}
  unsubscribe(symbol: string, callback: MarketDataCallback): void {}
}

export class BacktestEngine {
  async runBacktest(request: BacktestEngineRequest): Promise<BacktestEngineResult> {
    const {
      strategyName,
      symbol,
      startDate,
      endDate,
      initialCapital,
      params,
      historicalProvider,
      riskProfile
    } = request;

    try {
      // 1. Fetch historical candles chronologically
      const candles = await historicalProvider.getHistoricalData(symbol, startDate, endDate);
      if (candles.length === 0) {
        return {
          success: false,
          error: 'No historical market data found for the selected period.',
          metrics: { totalReturn: 0, cagr: 0, winRate: 0, profitFactor: 0, maxDrawdown: 0, sharpeRatio: 0, totalTrades: 0 },
          trades: [],
          equityCurve: []
        };
      }

      // 2. Initialize in-memory sandbox database
      const sandboxDb = createBacktestSandboxDb(initialCapital, riskProfile);

      // 3. Initialize sandboxed providers
      const sandboxMarketData = new SandboxedMarketDataProvider();
      const riskEngine = new RiskEngine(sandboxDb, sandboxMarketData);
      const tradingRouter = new PaperTradingService(sandboxDb, riskEngine, sandboxMarketData);

      // Cache values to perform computations in strategy loops
      const closePrices: number[] = [];
      const equityCurve: { date: string; value: number }[] = [];
      const trades: BacktestTrade[] = [];

      // Intercept PaperTradingService's _simulateFill method to run synchronously without setTimeout latency
      const originalSimulate = (PaperTradingService.prototype as any)._simulateFill;
      (PaperTradingService.prototype as any)._simulateFill = async function (this: any, userId: string, intent: any) {
        const executionId = `EXEC-BT-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        const executionPrice = await this.marketData.getPrice(intent.symbol);
        const payload = { simulated: true, timestamp: new Date().toISOString() };

        await this.supabase.rpc('execute_trade_v2', {
          p_execution_id: executionId,
          p_client_order_id: intent.clientOrderId,
          p_fill_qty: intent.qty,
          p_fill_price: executionPrice,
          p_sequence_number: 1,
          p_raw_payload: payload
        });
      };

      try {
        // Main chronological backtesting loop
        for (let t = 0; t < candles.length; t++) {
          const bar = candles[t];
          closePrices.push(bar.close);
          sandboxMarketData.setPrice(bar.close);

          // Get sandbox cash and positions
          const { data: portfolio } = await sandboxDb.from('portfolio_state').select('cash_balance').single();
          const cash = portfolio?.cash_balance || 0;

          const { data: position } = await sandboxDb.from('position_state').select('qty').eq('symbol', symbol).maybeSingle();
          const currentQty = Number(position?.qty) || 0;

          // Strategy logic evaluations
          let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

          if (strategyName === 'MA_CROSSOVER') {
            const fastPeriod = params.fastPeriod || 5;
            const slowPeriod = params.slowPeriod || 20;

            if (closePrices.length > slowPeriod) {
              const fastSMA_curr = this.calculateSMA(closePrices, fastPeriod);
              const slowSMA_curr = this.calculateSMA(closePrices, slowPeriod);
              const fastSMA_prev = this.calculateSMA(closePrices.slice(0, -1), fastPeriod);
              const slowSMA_prev = this.calculateSMA(closePrices.slice(0, -1), slowPeriod);

              if (fastSMA_prev <= slowSMA_prev && fastSMA_curr > slowSMA_curr) {
                signal = 'BUY';
              } else if (fastSMA_prev >= slowSMA_prev && fastSMA_curr < slowSMA_curr) {
                signal = 'SELL';
              }
            }
          } else if (strategyName === 'RSI_REVERSION') {
            const rsiPeriod = params.rsiPeriod || 14;
            const overbought = params.overbought || 70;
            const oversold = params.oversold || 30;

            if (closePrices.length > rsiPeriod) {
              const rsi_curr = this.calculateRSI(closePrices, rsiPeriod);
              const rsi_prev = this.calculateRSI(closePrices.slice(0, -1), rsiPeriod);

              if (rsi_prev >= oversold && rsi_curr < oversold) {
                signal = 'BUY';
              } else if (rsi_prev <= overbought && rsi_curr > overbought) {
                signal = 'SELL';
              }
            }
          }

          // Execute trades based on signals
          const orderSize = params.orderSize || 10;
          if (signal === 'BUY') {
            const cost = orderSize * bar.close;
            if (cash >= cost) {
              const res = await tradingRouter.placeOrder({
                symbol,
                side: 'BUY',
                type: 'MARKET',
                qty: orderSize
              });

              if (res.success && res.order) {
                trades.push({
                  date: bar.date,
                  symbol,
                  side: 'BUY',
                  qty: orderSize,
                  price: bar.close,
                  totalValue: cost
                });
              }
            }
          } else if (signal === 'SELL' && currentQty > 0) {
            const sellQty = Math.min(currentQty, orderSize);
            const res = await tradingRouter.placeOrder({
              symbol,
              side: 'SELL',
              type: 'MARKET',
              qty: sellQty
            });

            if (res.success && res.order) {
              trades.push({
                date: bar.date,
                symbol,
                side: 'SELL',
                qty: sellQty,
                price: bar.close,
                totalValue: sellQty * bar.close
              });
            }
          }

          // Fetch updated holdings valuation
          const { data: updatedPortfolio } = await sandboxDb.from('portfolio_state').select('cash_balance').single();
          const finalCash = updatedPortfolio?.cash_balance || 0;

          const { data: updatedPos } = await sandboxDb.from('position_state').select('qty').eq('symbol', symbol).maybeSingle();
          const finalQty = Number(updatedPos?.qty) || 0;

          const totalAssetValue = finalCash + finalQty * bar.close;
          equityCurve.push({ date: bar.date, value: totalAssetValue });
        }
      } finally {
        // Restore original _simulateFill to ensure zero side-effects
        (PaperTradingService.prototype as any)._simulateFill = originalSimulate;
      }

      // 4. Calculate performance metrics
      const metrics = BacktestMetricsCalculator.calculate(equityCurve, trades, initialCapital);

      return {
        success: true,
        metrics,
        trades,
        equityCurve
      };
    } catch (err) {
      console.error('[BacktestEngine] Backtest simulation crashed:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Simulation failed: ${errorMsg}`,
        metrics: { totalReturn: 0, cagr: 0, winRate: 0, profitFactor: 0, maxDrawdown: 0, sharpeRatio: 0, totalTrades: 0 },
        trades: [],
        equityCurve: []
      };
    }
  }

  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const slice = prices.slice(-period);
    return slice.reduce((sum, p) => sum + p, 0) / period;
  }

  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length <= period) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) {
        gains += diff;
      } else {
        losses -= diff;
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
}

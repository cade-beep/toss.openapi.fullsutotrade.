import { BacktestRequest, BacktestResult } from '@/types/strategy';
import { supabase } from '@/lib/supabase/client';
import { 
  BacktestEngine, 
  BacktestEngineRequest 
} from './backtest-engine';
import { 
  DatabaseHistoricalDataProvider, 
  CSVHistoricalDataProvider 
} from '../market/historical-provider';

export class Backtester {
  async runBacktest(request: BacktestRequest): Promise<BacktestResult> {
    console.log(`[Backtester] Initializing strategy backtest loop: ${request.strategyName} on ${request.symbol}...`);
    
    // Choose appropriate historical market provider
    const provider = request.csvContent 
      ? new CSVHistoricalDataProvider(request.csvContent)
      : (() => {
          if (!supabase) {
            throw new Error('Supabase client is not initialized. Please configure database environment keys.');
          }
          return new DatabaseHistoricalDataProvider(supabase);
        })();

    // Map user UI strategy name strings to engine string representations
    let mappedStrategy: 'MA_CROSSOVER' | 'RSI_REVERSION' = 'MA_CROSSOVER';
    if (request.strategyName.includes('RSI') || request.strategyName === 'RSI_REVERSION') {
      mappedStrategy = 'RSI_REVERSION';
    }

    // Default configuration params if omitted
    const defaultParams: Record<string, number> = mappedStrategy === 'MA_CROSSOVER' 
      ? { fastPeriod: 5, slowPeriod: 20, orderSize: 10 }
      : { rsiPeriod: 14, overbought: 70, oversold: 30, orderSize: 10 };

    const engineRequest: BacktestEngineRequest = {
      strategyName: mappedStrategy,
      symbol: request.symbol,
      startDate: request.startDate,
      endDate: request.endDate,
      initialCapital: request.initialCapital,
      params: { ...defaultParams, ...request.params },
      historicalProvider: provider
    };

    const engine = new BacktestEngine();
    const result = await engine.runBacktest(engineRequest);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Backtest simulation execution failed.'
      };
    }

    const finalVal = result.equityCurve.length > 0 
      ? result.equityCurve[result.equityCurve.length - 1].value 
      : request.initialCapital;

    return {
      success: true,
      metrics: {
        cagr: result.metrics.cagr,
        maxDrawdown: result.metrics.maxDrawdown,
        sharpeRatio: result.metrics.sharpeRatio,
        winRate: result.metrics.winRate,
        totalTrades: result.metrics.totalTrades,
        finalValue: finalVal,
        totalReturn: result.metrics.totalReturn,
        profitFactor: result.metrics.profitFactor
      },
      trades: result.trades,
      equityCurve: result.equityCurve
    };
  }
}

export const backtester = new Backtester();

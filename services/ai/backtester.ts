import { BacktestRequest, BacktestResult } from '@/types/strategy';

export class Backtester {
  async runBacktest(request: BacktestRequest): Promise<BacktestResult> {
    console.log(`[Backtester] Running historical simulation for ${request.symbol} with ${request.strategyName}...`);
    
    // Return dummy metrics for UI verification
    return {
      success: true,
      metrics: {
        cagr: 0.142, // 14.2%
        maxDrawdown: 0.075, // 7.5%
        sharpeRatio: 2.1,
        winRate: 0.58,
        totalTrades: 15,
        finalValue: request.initialCapital * 1.142,
      },
      trades: [
        {
          date: request.startDate,
          symbol: request.symbol,
          side: 'BUY',
          qty: 10,
          price: 65000,
          totalValue: 650000,
        },
        {
          date: request.endDate,
          symbol: request.symbol,
          side: 'SELL',
          qty: 10,
          price: 74200,
          totalValue: 742000,
        }
      ]
    };
  }
}

export const backtester = new Backtester();

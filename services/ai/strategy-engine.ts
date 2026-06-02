import { AISignal, StrategyConfig } from '@/types/strategy';

export class StrategyEngine {
  async getActiveStrategies(): Promise<StrategyConfig[]> {
    // Placeholder returning empty or dummy configs
    return [
      {
        id: 'strategy-ma-crossover',
        name: 'Moving Average Crossover',
        isActive: false,
        allocationPct: 30,
        params: { fastPeriod: 5, slowPeriod: 20 },
      },
      {
        id: 'strategy-rsi-mean-reversion',
        name: 'RSI Mean Reversion',
        isActive: false,
        allocationPct: 20,
        params: { overbought: 70, oversold: 30 },
      }
    ];
  }

  async toggleStrategy(strategyId: string, isActive: boolean): Promise<boolean> {
    console.log(`[StrategyEngine] Strategy ${strategyId} active state toggled to: ${isActive}`);
    return true;
  }

  async getLatestSignals(limit?: number): Promise<AISignal[]> {
    // Return a default dummy signal for visual testing
    return [
      {
        id: 'sig-dummy-1',
        symbol: '005930',
        action: 'BUY',
        confidenceScore: 0.85,
        reasoning: {
          textSummary: 'Samsung Electronics is showing a golden cross on the 5-day and 20-day moving averages with strong volume increase.',
          indicatorsUsed: [
            { name: '5-MA', value: '70,500', condition: 'Crossed above 20-MA' },
            { name: 'RSI', value: '45.2', condition: 'Neutral, trending up' },
            { name: 'Volume', value: '150%', condition: 'Above 10-day average' }
          ],
          marketSentiment: 'BULLISH'
        },
        createdAt: new Date().toISOString()
      }
    ];
  }

  async generateSignal(symbol: string): Promise<AISignal | null> {
    console.log(`[StrategyEngine] Generating signal for ${symbol}...`);
    return null;
  }
}

export const strategyEngine = new StrategyEngine();

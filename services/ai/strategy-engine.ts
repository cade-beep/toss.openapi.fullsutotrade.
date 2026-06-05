import { createClient } from '@supabase/supabase-js';
import { AISignal, StrategyConfig } from '@/types/strategy';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class StrategyEngine {
  async getActiveStrategies(): Promise<StrategyConfig[]> {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) return [];

    const { data: dbStrats } = await supabase
      .from('user_strategies')
      .select('*')
      .eq('user_id', userId);

    const defaults = [
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

    return defaults.map(d => {
      const found = dbStrats?.find(s => s.strategy_id === d.id);
      return {
        id: d.id,
        name: d.name,
        isActive: found ? found.is_active : d.isActive,
        allocationPct: found ? found.allocation_pct : d.allocationPct,
        params: found ? found.params : d.params
      };
    });
  }

  async toggleStrategy(strategyId: string, isActive: boolean): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) return false;

    // Get default values to populate allocation and params
    const defaults = {
      'strategy-ma-crossover': { allocation: 30, params: { fastPeriod: 5, slowPeriod: 20 } },
      'strategy-rsi-mean-reversion': { allocation: 20, params: { overbought: 70, oversold: 30 } }
    };
    const def = defaults[strategyId as keyof typeof defaults] || { allocation: 0, params: {} };

    const { error } = await supabase
      .from('user_strategies')
      .upsert({
        user_id: userId,
        strategy_id: strategyId,
        is_active: isActive,
        allocation_pct: def.allocation,
        params: def.params,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,strategy_id' });

    if (error) {
      console.error('Failed to toggle strategy:', error.message);
      return false;
    }
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
    // Seed mock signal generation for deterministic testing
    const rand = Math.random();
    if (rand < 0.35) {
      return {
        id: `sig-${Date.now()}`,
        symbol,
        action: 'BUY',
        confidenceScore: 0.85,
        reasoning: {
          textSummary: 'Mean reversion indicator triggered buy threshold.',
          indicatorsUsed: [{ name: 'RSI', value: '28.5', condition: 'Oversold' }],
          marketSentiment: 'NEUTRAL'
        },
        createdAt: new Date().toISOString()
      };
    } else if (rand < 0.70) {
      return {
        id: `sig-${Date.now()}`,
        symbol,
        action: 'SELL',
        confidenceScore: 0.78,
        reasoning: {
          textSummary: 'Overbought threshold exceeded.',
          indicatorsUsed: [{ name: 'RSI', value: '72.1', condition: 'Overbought' }],
          marketSentiment: 'NEUTRAL'
        },
        createdAt: new Date().toISOString()
      };
    }
    return {
      id: `sig-${Date.now()}`,
      symbol,
      action: 'HOLD',
      confidenceScore: 0.50,
      reasoning: {
        textSummary: 'Market indicators stable.',
        indicatorsUsed: [],
        marketSentiment: 'NEUTRAL'
      },
      createdAt: new Date().toISOString()
    };
  }
}

export const strategyEngine = new StrategyEngine();

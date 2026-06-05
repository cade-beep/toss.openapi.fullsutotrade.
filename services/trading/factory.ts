import { SupabaseClient } from '@supabase/supabase-js';
import { TradingService } from './interface';
import { PaperTradingService } from './paper-trading-service';
import { TossTradingService } from './toss-api';
import { RiskEngine } from '../risk/risk-engine';

export class TradingServiceFactory {
  static getService(
    mode: 'SIMULATION' | 'PAPER' | 'LIVE', 
    supabase: SupabaseClient, 
    riskEngine?: RiskEngine
  ): TradingService {
    if (mode === 'LIVE') {
      return new TossTradingService(supabase, riskEngine);
    }
    // Simulation and Paper modes both run in PaperTradingService in this context
    return new PaperTradingService(supabase, riskEngine);
  }
}

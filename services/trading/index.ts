import { tossTradingService } from './toss-api';
import { TradingService } from './interface';

export const tradingService: TradingService = tossTradingService;
export type { TradingService };

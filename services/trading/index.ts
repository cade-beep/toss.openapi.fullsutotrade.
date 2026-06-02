import { mockTradingService } from './mock-sandbox';
import { tossTradingService } from './toss-api';
import { TradingService } from './interface';

const isLive = process.env.NEXT_PUBLIC_TRADING_MODE === 'LIVE';

export const tradingService: TradingService = isLive ? tossTradingService : mockTradingService;
export type { TradingService };

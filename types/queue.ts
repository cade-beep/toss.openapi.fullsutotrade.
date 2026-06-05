import { TradeIntent } from './strategy';
import { BrokerExecutionEvent } from './trading';

export interface StrategyTickPayload {
  userId: string;
  strategyId: string;
}

export interface OrderExecutionPayload {
  userId: string;
  intent: TradeIntent;
}

export interface BrokerEventPayload {
  event: Omit<BrokerExecutionEvent, 'processed_at'>;
}

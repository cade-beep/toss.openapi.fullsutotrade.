import { OrderSide, OrderType } from './trading';

export type SignalAction = 'BUY' | 'SELL' | 'HOLD';

export interface AISignalReasoning {
  textSummary: string;
  indicatorsUsed: {
    name: string;
    value: string;
    condition: string;
  }[];
  marketSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface AISignal {
  id: string;
  symbol: string;
  action: SignalAction;
  confidenceScore: number;
  reasoning: AISignalReasoning;
  createdAt: string;
}

export interface StrategyConfig {
  id: string;
  name: string;
  isActive: boolean;
  allocationPct: number;
  params: Record<string, any>;
}

export interface BacktestRequest {
  strategyName: string;
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
}

export interface BacktestResult {
  success: boolean;
  metrics?: {
    cagr: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    totalTrades: number;
    finalValue: number;
  };
  trades?: {
    date: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    qty: number;
    price: number;
    totalValue: number;
  }[];
  error?: string;
}

export interface TradeIntent {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  price?: number;
  clientOrderId: string;
  isAI?: boolean;
  aiConfidence?: number;
}

export interface RiskValidationResult {
  isValid: boolean;
  rejectionReason?: string;
  adjustedQty?: number;
}


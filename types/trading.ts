export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT';
export type OrderStatus = 'PENDING' | 'SUBMITTED' | 'FILLED' | 'REJECTED' | 'CANCELLED';

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  price?: number;
  status: OrderStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  symbol: string;
  qty: number;
  avgBuyPrice: number;
  currentPrice: number;
}

export interface AccountBalance {
  cashBalance: number;
  purchasingPower: number;
  totalPortfolioValue: number;
  unrealizedPnL: number;
}

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  price?: number;
}

export interface OrderResponse {
  success: boolean;
  order?: Order;
  error?: string;
}

export type OrderStatusV2 = 'PENDING' | 'SUBMITTED' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLING' | 'CANCELLED' | 'REJECTED';

export interface BrokerExecutionEvent {
  execution_id: string;
  client_order_id: string;
  broker_order_id: string;
  event_type: 'ACK' | 'PARTIAL_FILL' | 'FULL_FILL' | 'CANCEL' | 'REPLACE' | 'REJECT';
  sequence_number: number;
  filled_qty: number;
  execution_price: number;
  raw_payload: any;
  processed_at: string;
}

export interface OrderV2 {
  client_order_id: string;
  broker_order_id?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  price?: number;
  status: OrderStatusV2;
  filled_qty: number;
  avg_fill_price: number;
  trading_mode: 'SIMULATION' | 'PAPER' | 'LIVE';
  last_sequence_number: number;
  created_at: string;
  updated_at: string;
}

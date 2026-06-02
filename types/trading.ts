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

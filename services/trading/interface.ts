import { OrderRequest, OrderResponse, Position, AccountBalance } from '@/types/trading';

export interface TradingService {
  placeOrder(request: OrderRequest): Promise<OrderResponse>;
  cancelOrder(orderId: string): Promise<boolean>;
  getAccountBalance(): Promise<AccountBalance>;
  getPositions(): Promise<Position[]>;
  getMarketPrice(symbol: string): Promise<number>;
}

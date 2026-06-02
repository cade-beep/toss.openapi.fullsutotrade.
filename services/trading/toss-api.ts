import { TradingService } from './interface';
import { OrderRequest, OrderResponse, Position, AccountBalance } from '@/types/trading';

export class TossTradingService implements TradingService {
  async placeOrder(request: OrderRequest): Promise<OrderResponse> {
    throw new Error('Toss Open API is not integrated yet.');
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    throw new Error('Toss Open API is not integrated yet.');
  }

  async getAccountBalance(): Promise<AccountBalance> {
    throw new Error('Toss Open API is not integrated yet.');
  }

  async getPositions(): Promise<Position[]> {
    throw new Error('Toss Open API is not integrated yet.');
  }

  async getMarketPrice(symbol: string): Promise<number> {
    throw new Error('Toss Open API is not integrated yet.');
  }
}

export const tossTradingService = new TossTradingService();

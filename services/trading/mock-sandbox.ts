import { TradingService } from './interface';
import { OrderRequest, OrderResponse, Position, AccountBalance } from '@/types/trading';

export class MockTradingService implements TradingService {
  async placeOrder(request: OrderRequest): Promise<OrderResponse> {
    const isLimit = request.type === 'LIMIT';
    const executionPrice = request.price || 70000;
    
    return {
      success: true,
      order: {
        id: `mock-order-${Math.random().toString(36).substring(2, 9)}`,
        symbol: request.symbol,
        side: request.side,
        type: request.type,
        qty: request.qty,
        price: request.price,
        status: isLimit ? 'SUBMITTED' : 'FILLED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    console.log(`[MockTradingService] Order ${orderId} cancelled.`);
    return true;
  }

  async getAccountBalance(): Promise<AccountBalance> {
    return {
      cashBalance: 10000000, // 10,000,000 KRW
      purchasingPower: 10000000,
      totalPortfolioValue: 10000000,
      unrealizedPnL: 0,
    };
  }

  async getPositions(): Promise<Position[]> {
    return [
      {
        id: 'mock-pos-1',
        symbol: '005930', // Samsung Electronics
        qty: 10,
        avgBuyPrice: 68500,
        currentPrice: 70000,
      }
    ];
  }

  async getMarketPrice(symbol: string): Promise<number> {
    // Return dummy price based on symbol
    if (symbol === '005930') return 70000; // Samsung
    if (symbol === '035420') return 180000; // NAVER
    if (symbol === '000660') return 150000; // SK Hynix
    return 50000;
  }
}
export const mockTradingService = new MockTradingService();

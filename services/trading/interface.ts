import { OrderRequest, OrderResponse, Position, AccountBalance, OrderV2 } from '../../types/trading';

export interface TradingService {
  /**
   * Places an order and returns an acknowledgment (OrderResponse).
   * Note: The execution itself may be simulated or queued depending on the implementation.
   */
  placeOrder(request: OrderRequest, clientOrderId?: string): Promise<OrderResponse>;

  /**
   * Attempts to cancel a pending order.
   */
  cancelOrder(clientOrderId: string): Promise<boolean>;

  /**
   * Retrieves the current user's positions.
   */
  getPositions(): Promise<Position[]>;

  /**
   * Retrieves the current user's account balance.
   */
  getAccountBalance(): Promise<AccountBalance>;

  /**
   * Retrieves an order's status by its client order ID.
   */
  getOrder(clientOrderId: string): Promise<OrderV2 | null>;

  /**
   * Query the broker exchange directly for the current status of an order.
   */
  fetchOrderFromBroker(clientOrderId: string): Promise<OrderV2 | null>;
}

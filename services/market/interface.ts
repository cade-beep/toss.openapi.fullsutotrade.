export type MarketDataCallback = (price: number) => void;

export interface MarketDataProvider {
  /**
   * Retrieves the current instantaneous price for a given symbol.
   */
  getPrice(symbol: string): Promise<number>;

  /**
   * Subscribes to real-time price updates for a given symbol.
   */
  subscribe(symbol: string, callback: MarketDataCallback): void;

  /**
   * Unsubscribes from real-time price updates.
   */
  unsubscribe(symbol: string, callback: MarketDataCallback): void;
}

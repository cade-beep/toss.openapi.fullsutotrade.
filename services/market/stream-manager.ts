export class StreamManager {
  /**
   * Subscribe to live stock price changes.
   * Simulates a streaming price update via client-side polling callback.
   * Returns a function to unsubscribe and clear resources.
   */
  async subscribeToSymbol(symbol: string, callback: (price: number) => void): Promise<() => void> {
    console.log(`[StreamManager] Subscribing to stock ticker updates: ${symbol}`);
    
    const basePrices: Record<string, number> = {
      '005930': 70000,
      '035420': 180000,
      '000660': 150000
    };
    
    const basePrice = basePrices[symbol] || 50000;

    const interval = setInterval(() => {
      // Generate a small mock price drift (-0.2% to +0.2%)
      const driftPercent = (Math.random() - 0.5) * 0.004; 
      const newPrice = Math.round(basePrice * (1 + driftPercent));
      callback(newPrice);
    }, 3000);

    return () => {
      console.log(`[StreamManager] Unsubscribed from ticker updates: ${symbol}`);
      clearInterval(interval);
    };
  }
}

export const streamManager = new StreamManager();

import { MarketDataProvider, MarketDataCallback } from './interface';

export class MockMarketDataProvider implements MarketDataProvider {
  private basePrices: Record<string, number>;

  constructor(basePrices: Record<string, number> = { 'AAPL': 150000, 'TSLA': 200000, 'SPY': 500000 }) {
    this.basePrices = basePrices;
  }

  /**
   * Generates a stable numeric hash from a string to determine a reproducible base price
   * for symbols that were not explicitly seeded.
   */
  private hashSymbol(symbol: string): number {
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = (hash << 5) - hash + symbol.charCodeAt(i);
      hash |= 0;
    }
    // Map to a base price between 10,000 and 100,000
    return Math.abs(hash % 90000) + 10000;
  }

  /**
   * Uses a deterministic mathematical formula to simulate a market random walk.
   * This is entirely stateless and guarantees the exact same price across all 
   * isolated serverless environments for a given millisecond.
   */
  async getPrice(symbol: string): Promise<number> {
    const basePrice = this.basePrices[symbol] || this.hashSymbol(symbol);
    
    const time = Date.now();
    // Deterministic random walk using sine/cosine waves of varying frequencies
    const drift = 1 + 
      0.05 * Math.sin(time / 10000) + 
      0.02 * Math.cos(time / 3333) + 
      0.01 * Math.sin(time / 777);

    return Math.round(basePrice * drift);
  }

  subscribe(symbol: string, callback: MarketDataCallback): void {
    // Stubbed. Serverless push architecture will be required for live feeds.
  }

  unsubscribe(symbol: string, callback: MarketDataCallback): void {
    // Stubbed.
  }
}

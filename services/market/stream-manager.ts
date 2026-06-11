export class StreamManager {
  async subscribeToSymbol(symbol: string, callback: (price: number) => void): Promise<() => void> {
    throw new Error("StreamManager subscription is deactivated. Live stream updates are not available.");
  }
}

export const streamManager = new StreamManager();

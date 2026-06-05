import Redis from 'ioredis';
import { getRedisClient } from '../../lib/redis';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private redis: Redis | null = null;
  private keyPrefix = 'toss:circuit';
  private failureThreshold = 5;
  private cooldownMs = 300000; // 5 minutes

  // Local fallback variables
  private localState: CircuitState = 'CLOSED';
  private localErrorCount = 0;
  private localCooldownExpiry = 0;

  constructor(failureThreshold = 5, cooldownMs = 300000, redisClient?: Redis) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;

    try {
      this.redis = redisClient || getRedisClient();
    } catch (err) {
      console.warn('[CircuitBreaker] Failed to initialize Redis. Using local memory fallback.');
    }
  }

  private async getState(): Promise<{ state: CircuitState; errorCount: number; cooldownExpiry: number }> {
    if (this.redis && this.redis.status === 'ready') {
      try {
        const state = (await this.redis.get(`${this.keyPrefix}:state`)) as CircuitState || 'CLOSED';
        const errorCount = parseInt((await this.redis.get(`${this.keyPrefix}:error_count`)) || '0', 10);
        const cooldownExpiry = parseInt((await this.redis.get(`${this.keyPrefix}:cooldown_expiry`)) || '0', 10);
        return { state, errorCount, cooldownExpiry };
      } catch (err: any) {
        console.warn('[CircuitBreaker] Failed to read Redis state, using local:', err.message);
      }
    }
    return {
      state: this.localState,
      errorCount: this.localErrorCount,
      cooldownExpiry: this.localCooldownExpiry
    };
  }

  private async updateState(state: CircuitState, errorCount: number, cooldownExpiry: number): Promise<void> {
    if (this.redis && this.redis.status === 'ready') {
      try {
        const pipeline = this.redis.multi();
        pipeline.set(`${this.keyPrefix}:state`, state);
        pipeline.set(`${this.keyPrefix}:error_count`, errorCount.toString());
        pipeline.set(`${this.keyPrefix}:cooldown_expiry`, cooldownExpiry.toString());
        await pipeline.exec();
        return;
      } catch (err: any) {
        console.warn('[CircuitBreaker] Failed to write Redis state, using local:', err.message);
      }
    }
    this.localState = state;
    this.localErrorCount = errorCount;
    this.localCooldownExpiry = cooldownExpiry;
  }

  /**
   * Checks if a call is allowed. Transitions from OPEN to HALF_OPEN if cooldown has expired.
   */
  async checkCall(): Promise<boolean> {
    const { state, cooldownExpiry } = await this.getState();
    const now = Date.now();

    if (state === 'OPEN') {
      if (now >= cooldownExpiry) {
        console.log('[CircuitBreaker] Cooldown expired. Transitioning to HALF_OPEN.');
        await this.updateState('HALF_OPEN', 0, 0);
        return true;
      }
      throw new Error('CircuitBreaker: Circuit is OPEN. Request blocked.');
    }

    return true;
  }

  /**
   * Records a successful execution. Resets state to CLOSED if it was in HALF_OPEN.
   */
  async recordSuccess(): Promise<void> {
    const { state } = await this.getState();
    if (state === 'HALF_OPEN') {
      console.log('[CircuitBreaker] Trial request succeeded. Transitioning to CLOSED.');
    }
    await this.updateState('CLOSED', 0, 0);
  }

  /**
   * Records a execution failure. Trips the circuit if error threshold is crossed.
   */
  async recordFailure(): Promise<void> {
    const { state, errorCount } = await this.getState();
    const newCount = errorCount + 1;

    if (state === 'HALF_OPEN' || newCount >= this.failureThreshold) {
      const expiry = Date.now() + this.cooldownMs;
      console.error(`[CircuitBreaker] Failure threshold reached. Transitioning to OPEN. Cooldown active for ${this.cooldownMs}ms.`);
      await this.updateState('OPEN', newCount, expiry);
    } else {
      await this.updateState(state, newCount, 0);
    }
  }

  async close() {
    if (this.redis) {
      let isSingleton = false;
      try {
        isSingleton = this.redis === getRedisClient();
      } catch (err) {}
      if (!isSingleton) {
        await this.redis.quit().catch(() => {});
      }
    }
  }
}

export const circuitBreaker = new CircuitBreaker();


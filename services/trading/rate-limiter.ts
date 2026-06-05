import Redis from 'ioredis';
import { getRedisClient } from '../../lib/redis';

export class RateLimiter {
  private redis: Redis | null = null;
  private localCache = new Map<string, number[]>();

  constructor(redisClient?: Redis) {
    try {
      this.redis = redisClient || getRedisClient();
    } catch (err) {
      console.warn('[RateLimiter] Failed to initialize Redis, using local memory fallback.');
    }
  }

  /**
   * Checks if the request is allowed under the rate limit.
   * Uses Redis sliding window log for distributed limits, or local memory fallback.
   */
  async isAllowed(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const now = Date.now();
    const clearBefore = now - windowSeconds * 1000;

    if (this.redis && this.redis.status === 'ready') {
      try {
        const redisKey = `rate_limit:${key}`;
        const pipeline = this.redis.multi();
        
        // Remove old timestamps
        pipeline.zremrangebyscore(redisKey, 0, clearBefore);
        // Add current timestamp
        pipeline.zadd(redisKey, now, now.toString());
        // Count active requests in window
        pipeline.zcard(redisKey);
        // Set expiry to keep Redis clean
        pipeline.expire(redisKey, windowSeconds * 2);

        const results = await pipeline.exec();
        if (!results) return false;

        const count = results[2][1] as number;
        return count <= limit;
      } catch (err: any) {
        console.warn('[RateLimiter] Redis error in isAllowed, falling back to local memory:', err.message);
      }
    }

    // Local memory fallback (Sliding Window Log)
    let timestamps = this.localCache.get(key) || [];
    timestamps = timestamps.filter((t) => t > clearBefore);
    
    if (timestamps.length >= limit) {
      return false;
    }

    timestamps.push(now);
    this.localCache.set(key, timestamps);
    return true;
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

export const rateLimiter = new RateLimiter();


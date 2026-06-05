import { ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

/**
 * Parses the REDIS_URL environment variable into BullMQ ConnectionOptions.
 * Enforces maxRetriesPerRequest = null as strictly required by BullMQ.
 */
export const getRedisConnectionOptions = (): ConnectionOptions => {
  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      username: url.username || undefined,
      password: url.password || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  } catch (err) {
    // Fallback to defaults
    return {
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
    };
  }
};

let redisClient: Redis | null = null;

/**
 * Returns a globally shared, lazy-instantiated singleton Redis client.
 */
export const getRedisClient = (): Redis => {
  if (!redisClient) {
    const opts = getRedisConnectionOptions() as any;
    redisClient = new Redis({
      host: opts.host,
      port: opts.port,
      username: opts.username,
      password: opts.password,
      maxRetriesPerRequest: null,
      commandTimeout: 2000,
      connectTimeout: 2000,
    });
    
    redisClient.on('error', (err) => {
      console.warn('[Redis Singleton] connection error:', err.message);
    });
  }
  return redisClient;
};

/**
 * Gracefully shuts down and cleans up the globally cached singleton Redis client.
 */
export const closeRedisClient = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (err) {
      // Ignore cleanup error if already disconnected
    }
    redisClient = null;
  }
};


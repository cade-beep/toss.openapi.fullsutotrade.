import { Queue } from 'bullmq';
import { getRedisConnectionOptions } from '../../lib/redis';

const connection = getRedisConnectionOptions();

export const STRATEGY_QUEUE_NAME = 'strategy-ticks';
export const ORDER_QUEUE_NAME = 'order-intents';

// Strategy Evaluation Tick Queue
export const strategyQueue = new Queue(STRATEGY_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s initial delay
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Order Execution Intent Queue
export const orderQueue = new Queue(ORDER_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s initial delay
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

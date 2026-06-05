import { Queue } from 'bullmq';
import { getRedisConnectionOptions } from '../../lib/redis';

const connection = getRedisConnectionOptions();

export const BROKER_EVENTS_QUEUE_NAME = 'broker-events';

// Reconciler Webhook Event Queue
export const brokerEventsQueue = new Queue(BROKER_EVENTS_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s initial delay
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

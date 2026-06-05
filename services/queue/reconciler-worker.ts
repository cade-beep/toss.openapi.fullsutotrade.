import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { getRedisConnectionOptions } from '../../lib/redis';
import { BROKER_EVENTS_QUEUE_NAME } from './reconciler-queues';
import { BrokerEventPayload } from '../../types/queue';

const connection = getRedisConnectionOptions();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseKey) {
  console.warn('[ReconcilerWorker] Warning: SUPABASE_SERVICE_ROLE_KEY is missing. RLS bypass will fail.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export const reconcilerWorker = new Worker(
  BROKER_EVENTS_QUEUE_NAME,
  async (job: Job<BrokerEventPayload>) => {
    const { event } = job.data;
    console.log(`[ReconcilerWorker] Processing execution event ${event.execution_id} for order ${event.client_order_id}`);

    // Call the refactored, unified execute_trade_v2 database RPC
    const { data, error } = await supabase.rpc('execute_trade_v2', {
      p_execution_id: event.execution_id,
      p_client_order_id: event.client_order_id,
      p_event_type: event.event_type,
      p_fill_qty: event.filled_qty,
      p_fill_price: event.execution_price,
      p_sequence_number: event.sequence_number,
      p_raw_payload: event.raw_payload
    });

    if (error) {
      console.error(`[ReconcilerWorker] Database transaction failed for event ${event.execution_id}:`, error.message);
      throw new Error(`DB settlement failed: ${error.message}`);
    }

    if (data && data.success) {
      console.log(`[ReconcilerWorker] Successfully processed event ${event.execution_id}. Message: ${data.message || 'State updated.'}`);
    } else {
      console.warn(`[ReconcilerWorker] Database transaction returned failure for event ${event.execution_id}:`, data);
      throw new Error('Database transaction returned unsuccessful status');
    }
  },
  { connection }
);

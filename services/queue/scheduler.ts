import { SupabaseClient } from '@supabase/supabase-js';
import { strategyQueue } from './queues';

/**
 * Registers a repeatable BullMQ job to run a strategy at a set interval.
 * Uses a unique jobId composite key to prevent duplicates.
 */
export async function registerStrategySchedule(userId: string, strategyId: string, intervalMs: number = 30000) {
  const jobId = `${userId}:${strategyId}`;
  
  // Clean up any existing repeatable job for this strategy/user pair first
  await removeStrategySchedule(userId, strategyId);

  await strategyQueue.add(
    'tick-strategy',
    { userId, strategyId },
    {
      repeat: {
        every: intervalMs,
      },
      jobId,
    }
  );
  console.log(`[Scheduler] Registered strategy repeatable tick for ${jobId} every ${intervalMs}ms`);
}

/**
 * Removes a repeatable strategy tick job by its unique jobId mapping.
 */
export async function removeStrategySchedule(userId: string, strategyId: string) {
  const jobId = `${userId}:${strategyId}`;
  const repeatableJobs = await strategyQueue.getRepeatableJobs();
  
  for (const job of repeatableJobs) {
    if (job.id === jobId) {
      await strategyQueue.removeRepeatableByKey(job.key);
      console.log(`[Scheduler] Removed repeatable job schedule: ${jobId}`);
    }
  }
}

/**
 * Syncs the local BullMQ repeat registry with the Supabase `user_strategies` state.
 */
export async function syncActiveStrategies(supabase: SupabaseClient) {
  console.log('[Scheduler] Syncing active strategies from DB...');
  
  const { data: activeStrategies, error } = await supabase
    .from('user_strategies')
    .select('user_id, strategy_id, is_active')
    .eq('is_active', true);

  if (error) {
    console.error('[Scheduler] Failed to fetch active strategies:', error.message);
    return;
  }

  const activeStrategiesList = activeStrategies || [];

  // Register active strategies
  for (const strat of activeStrategiesList) {
    await registerStrategySchedule(strat.user_id, strat.strategy_id);
  }

  // Remove repeatable jobs that are no longer active in Supabase
  const repeatableJobs = await strategyQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.id) {
      const [userId, strategyId] = job.id.split(':');
      const stillActive = activeStrategiesList.some(
        s => s.user_id === userId && s.strategy_id === strategyId
      );
      if (!stillActive) {
        await strategyQueue.removeRepeatableByKey(job.key);
        console.log(`[Scheduler] Pruned obsolete repeatable job: ${job.id}`);
      }
    }
  }
}

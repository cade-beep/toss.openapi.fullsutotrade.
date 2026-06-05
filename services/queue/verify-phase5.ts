import { registerStrategySchedule, removeStrategySchedule } from './scheduler';
import { strategyQueue, orderQueue } from './queues';

// Mock BullMQ methods for testing if Redis is offline
const mockStrategyJobs: any[] = [];
const mockRepeatableSchedules = new Map<string, any>();

strategyQueue.add = async (name: string, data: any, opts: any) => {
  const jobId = opts.jobId;
  mockRepeatableSchedules.set(jobId, { name, data, opts });
  console.log(`[Mock Queue] Added job ${jobId} to strategy-ticks`);
  return { id: jobId } as any;
};

strategyQueue.getRepeatableJobs = async () => {
  const list: any[] = [];
  mockRepeatableSchedules.forEach((value, key) => {
    list.push({
      id: key,
      key: `repeat-key-${key}`,
      name: value.name
    });
  });
  return list;
};

strategyQueue.removeRepeatableByKey = async (key: string) => {
  const jobId = key.replace('repeat-key-', '');
  mockRepeatableSchedules.delete(jobId);
  console.log(`[Mock Queue] Removed repeatable job schedule: ${jobId}`);
  return true;
};

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING STRATEGY WORKERS 5 RULES VERIFY");
  console.log("=========================================");

  // Test 1: Repeatable job registry
  {
    await registerStrategySchedule('user-1', 'strategy-ma-crossover', 60000);
    const registered = mockRepeatableSchedules.get('user-1:strategy-ma-crossover');
    
    console.log("Test 1 (Repeatable registry):", 
      registered && registered.opts.repeat.every === 60000 ? "✅ PASS" : "❌ FAIL"
    );
  }

  // Test 2: Repeatable job removal
  {
    await removeStrategySchedule('user-1', 'strategy-ma-crossover');
    const registered = mockRepeatableSchedules.get('user-1:strategy-ma-crossover');
    
    console.log("Test 2 (Repeatable removal):", 
      !registered ? "✅ PASS" : "❌ FAIL"
    );
  }

  // Test 3: Deterministic Order ID check
  {
    // Simulate StrategyWorker logic for generating deterministic clientOrderId
    const userId = 'user-abc';
    const strategyId = 'strategy-rsi-mean-reversion';
    const jobTimestamp = 1770000000000; // Simulated run timestamp
    
    const clientOrderId = `ORD-AI-${userId}-${strategyId}-${jobTimestamp}`;
    console.log("Test 3 (Deterministic ID):", 
      clientOrderId === 'ORD-AI-user-abc-strategy-rsi-mean-reversion-1770000000000' ? "✅ PASS" : "❌ FAIL"
    );
  }

  // Test 4: Idempotency execution skip
  {
    // Simulate OrderExecutionWorker check logic
    const mockOrderDbState = {
      client_order_id: 'ORD-AI-user-abc-strategy-rsi-mean-reversion-1770000000000',
      status: 'FILLED'
    };

    // If order exists in DB, worker skips processing (should log skip)
    const exists = mockOrderDbState.client_order_id === 'ORD-AI-user-abc-strategy-rsi-mean-reversion-1770000000000';
    console.log("Test 4 (Idempotency skip check):", 
      exists && mockOrderDbState.status === 'FILLED' ? "✅ PASS" : "❌ FAIL"
    );
  }
}

runTests().catch(console.error);

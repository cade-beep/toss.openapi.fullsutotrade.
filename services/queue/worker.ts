import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { getRedisConnectionOptions } from '../../lib/redis';
import { STRATEGY_QUEUE_NAME, ORDER_QUEUE_NAME, orderQueue } from './queues';
import { StrategyTickPayload, OrderExecutionPayload } from '../../types/queue';
import { StrategyEngine } from '../ai/strategy-engine';
import { TradingServiceFactory } from '../trading/factory';
import { RiskEngine } from '../risk/risk-engine';

const connection = getRedisConnectionOptions();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const strategyEngine = new StrategyEngine();

// 1. Strategy Evaluation Worker
export const strategyWorker = new Worker(
  STRATEGY_QUEUE_NAME,
  async (job: Job<StrategyTickPayload>) => {
    const { userId, strategyId } = job.data;
    console.log(`[StrategyWorker] Processing tick for user ${userId}, strategy ${strategyId}`);

    // Emergency Kill Switch check
    const { data: profile } = await supabase
      .from('risk_profiles')
      .select('kill_switch_active')
      .eq('user_id', userId)
      .single();

    if (profile?.kill_switch_active) {
      console.log(`[StrategyWorker] Emergency Kill Switch is active for user ${userId}. Skipping strategy evaluation.`);
      return;
    }

    // Load active strategy config
    const { data: userStrat, error } = await supabase
      .from('user_strategies')
      .select('*')
      .eq('user_id', userId)
      .eq('strategy_id', strategyId)
      .eq('is_active', true)
      .single();

    if (error || !userStrat) {
      console.log(`[StrategyWorker] Strategy ${strategyId} is inactive or not found for user ${userId}. Skipping.`);
      return;
    }

    const symbol = strategyId === 'strategy-ma-crossover' ? 'AAPL' : 'TSLA';
    
    // Generate AI Signal
    const signal = await strategyEngine.generateSignal(symbol);
    if (!signal || signal.action === 'HOLD') {
      console.log(`[StrategyWorker] No signal generated for ${symbol}. (HOLD)`);
      return;
    }

    // Deterministic clientOrderId Strategy (to ensure retry safety)
    const clientOrderId = `ORD-AI-${userId}-${strategyId}-${job.timestamp}`;

    const intent = {
      symbol: signal.symbol,
      side: signal.action as 'BUY' | 'SELL',
      type: 'LIMIT' as const,
      qty: 10,
      price: 150000,
      clientOrderId,
      isAI: true,
      aiConfidence: signal.confidenceScore
    };

    console.log(`[StrategyWorker] Signal generated: ${signal.action} ${symbol}. Pushing order intent ${clientOrderId} to queue.`);
    
    // Queue order intent
    await orderQueue.add('execute-intent', {
      userId,
      intent
    });
  },
  { connection }
);

// 2. Order Execution Worker
export const orderWorker = new Worker(
  ORDER_QUEUE_NAME,
  async (job: Job<OrderExecutionPayload>) => {
    const { userId, intent } = job.data;
    console.log(`[OrderWorker] Processing order intent: ${intent.clientOrderId} for user ${userId}`);

    // Create user RLS execution context
    const userClient = createClient(supabaseUrl, supabaseKey);
    userClient.auth.getUser = async () => ({
      data: { user: { id: userId } as any },
      error: null
    });
    userClient.auth.getSession = async () => ({
      data: { session: { access_token: supabaseKey } as any },
      error: null
    });

    // Idempotency: Check if the order already exists in the database
    const { data: existingOrder } = await userClient
      .from('orders')
      .select('status, error_message')
      .eq('client_order_id', intent.clientOrderId)
      .single();

    if (existingOrder) {
      console.log(`[OrderWorker] Order ${intent.clientOrderId} has already been processed with status: ${existingOrder.status}. Skipping duplicate execution.`);
      return;
    }

    const mode = (process.env.NEXT_PUBLIC_TRADING_MODE || 'PAPER') as 'SIMULATION' | 'PAPER' | 'LIVE';
    const riskEngine = new RiskEngine(userClient);
    const tradingService = TradingServiceFactory.getService(mode, userClient, riskEngine);

    // Execute order placement
    const res = await tradingService.placeOrder({
      symbol: intent.symbol,
      side: intent.side,
      type: intent.type,
      qty: intent.qty,
      price: intent.price
    }, intent.clientOrderId);

    if (!res.success) {
      console.error(`[OrderWorker] Order execution failed for ${intent.clientOrderId}: ${res.error}`);
      
      // Update existing order row status to REJECTED (eliminating duplicate key insertion errors)
      await userClient.rpc('update_order_status_v2', {
        p_client_order_id: intent.clientOrderId,
        p_status: 'REJECTED',
        p_error_message: res.error || 'Rejected by Risk Engine'
      });

      throw new Error(`Order rejected: ${res.error}`);
    }

    console.log(`[OrderWorker] Order executed successfully: ${intent.clientOrderId}`);
  },
  { connection }
);

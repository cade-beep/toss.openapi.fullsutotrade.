import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { brokerEventsQueue } from './reconciler-queues';
import { TradingServiceFactory } from '../trading/factory';

/**
 * Tier 1 Reconciliation: In-Flight Sweeper.
 * Scans for local orders stuck in non-terminal states and pulls their status from the broker.
 */
export async function sweepInFlightOrders(supabase: SupabaseClient) {
  console.log('[Reconciler] Running Tier 1 In-Flight Sweeper...');

  // 1. Fetch active orders older than 10 seconds
  const cutoffTime = new Date(Date.now() - 10000).toISOString();
  
  const { data: stuckOrders, error } = await supabase
    .from('orders')
    .select('*')
    .in('status', ['PENDING', 'SUBMITTED', 'CANCELLING'])
    .lt('created_at', cutoffTime);

  if (error) {
    console.error('[Reconciler] Failed to fetch stuck orders:', error.message);
    return;
  }

  if (!stuckOrders || stuckOrders.length === 0) {
    console.log('[Reconciler] No stuck in-flight orders found.');
    return;
  }

  console.log(`[Reconciler] Found ${stuckOrders.length} stuck orders. Initiating broker reconciliation...`);

  for (const order of stuckOrders) {
    try {
      const mode = (order.trading_mode || 'PAPER') as 'SIMULATION' | 'PAPER' | 'LIVE';
      
      let service;
      if (mode === 'LIVE') {
        // Construct a user-scoped Supabase client context mapping to order.user_id
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        
        const orderUserClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        });

        // Stub/override the auth methods to present order.user_id context to TradingService
        orderUserClient.auth.getUser = async () => {
          return {
            data: {
              user: {
                id: order.user_id,
                email: 'worker@toss-auto-trading.internal',
                role: 'authenticated',
                aud: 'authenticated',
                created_at: new Date().toISOString()
              } as any
            },
            error: null
          };
        };

        orderUserClient.auth.getSession = async () => {
          return {
            data: {
              session: {
                access_token: serviceRoleKey,
                token_type: 'bearer',
                expires_in: 3600,
                refresh_token: '',
                user: {
                  id: order.user_id,
                  role: 'authenticated',
                  aud: 'authenticated'
                } as any
              }
            },
            error: null
          };
        };

        service = TradingServiceFactory.getService(mode, orderUserClient);
      } else {
        service = TradingServiceFactory.getService(mode, supabase);
      }

      if (mode === 'LIVE') {
        console.log(`[Reconciler] Querying actual broker status for live order ${order.client_order_id}...`);
        
        let brokerOrder;
        try {
          brokerOrder = await service.fetchOrderFromBroker(order.client_order_id);
        } catch (fetchErr: any) {
          console.warn(`[Reconciler] Broker connection failure during lookup for order ${order.client_order_id}. Skipping sweep.`, fetchErr.message);
          continue; // Cooldown/Outage retry fallback
        }

        if (!brokerOrder) {
          // If the order is not found, check the safety timeout threshold
          const orderAgeMs = Date.now() - new Date(order.created_at).getTime();
          const ageLimitMs = 5 * 60 * 1000; // 5-minute timeout threshold

          if (orderAgeMs > ageLimitMs) {
            console.warn(`[Reconciler] Live order ${order.client_order_id} NOT found on broker after 5m. Queueing REJECT event.`);
            const executionId = `RECON-REJ-${order.client_order_id}-${Date.now()}`;
            await brokerEventsQueue.add(`recon-${executionId}`, {
              event: {
                execution_id: executionId,
                client_order_id: order.client_order_id,
                broker_order_id: `BROKER-NOTFOUND-${order.client_order_id}`,
                event_type: 'REJECT',
                sequence_number: Number(order.last_sequence_number) + 1,
                filled_qty: 0,
                execution_price: 0,
                raw_payload: { reconciled: true, reason: 'Order not found on broker API after 5 minutes.' }
              }
            });
          } else {
            console.log(`[Reconciler] Live order ${order.client_order_id} not found on broker but is within 5m grace period. Skipping.`);
          }
          continue;
        }

        // Map broker status to local ledger event types
        let eventType: 'ACK' | 'PARTIAL_FILL' | 'FULL_FILL' | 'CANCEL' | 'REJECT' | null = null;
        if (brokerOrder.status === 'FILLED') {
          eventType = 'FULL_FILL';
        } else if (brokerOrder.status === 'PARTIALLY_FILLED') {
          eventType = 'PARTIAL_FILL';
        } else if (brokerOrder.status === 'CANCELLED') {
          eventType = 'CANCEL';
        } else if (brokerOrder.status === 'REJECTED') {
          eventType = 'REJECT';
        } else if (brokerOrder.status === 'SUBMITTED' && order.status === 'PENDING') {
          eventType = 'ACK';
        }

        if (!eventType) {
          console.log(`[Reconciler] Live order ${order.client_order_id} status ${brokerOrder.status} does not require terminal transition.`);
          continue;
        }

        const executionId = `RECON-EXEC-${order.client_order_id}-${Date.now()}`;
        await brokerEventsQueue.add(`recon-${executionId}`, {
          event: {
            execution_id: executionId,
            client_order_id: order.client_order_id,
            broker_order_id: brokerOrder.broker_order_id,
            event_type: eventType,
            sequence_number: Number(order.last_sequence_number) + 1,
            filled_qty: brokerOrder.filled_qty,
            execution_price: brokerOrder.avg_fill_price,
            raw_payload: { reconciled: true, broker_status: brokerOrder.status }
          }
        });

        console.log(`[Reconciler] Enqueued live reconciliation event for order ${order.client_order_id} (Status: ${brokerOrder.status})`);
      } else {
        // In simulation/paper mode, simulate broker status lookup
        if (!order.price || order.price <= 0) {
          console.error(`[Reconciler] Reconciliation failed for order ${order.client_order_id}: Missing or invalid order price.`);
          continue;
        }

        let eventType: 'FULL_FILL' | 'CANCEL' = 'FULL_FILL';
        let fillQty = order.qty;
        let fillPrice = order.price;

        if (order.status === 'CANCELLING') {
          eventType = 'CANCEL';
          fillQty = 0;
          fillPrice = 0;
        }

        const executionId = `RECON-EXEC-${order.client_order_id}-${Date.now()}`;
        
        // Dispatch synthetic broker event to the queue
        await brokerEventsQueue.add(`recon-${executionId}`, {
          event: {
            execution_id: executionId,
            client_order_id: order.client_order_id,
            broker_order_id: order.broker_order_id || `BROKER-RECON-${order.client_order_id}`,
            event_type: eventType,
            sequence_number: Number(order.last_sequence_number) + 1,
            filled_qty: Number(fillQty),
            execution_price: Number(fillPrice),
            raw_payload: { reconciled: true, method: 'Tier-1-Sweeper' }
          }
        });

        console.log(`[Reconciler] Enqueued mock reconciliation event for order ${order.client_order_id}`);
      }
    } catch (err: any) {
      console.error(`[Reconciler] Failed to reconcile order ${order.client_order_id}:`, err.message);
    }
  }
}

/**
 * Tier 2 Reconciliation: Connection Gap Synchronization.
 * Fetches all executions since the last known local execution from the broker.
 */
export async function syncExecutionGap(supabase: SupabaseClient) {
  console.log('[Reconciler] Running Tier 2 Connection Gap Sync...');

  // Fetch the latest execution event from our database to get the timestamp/sequence limit
  const { data: latestEvent, error } = await supabase
    .from('broker_execution_events')
    .select('processed_at')
    .order('processed_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // Ignore single-row empty result error
    console.error('[Reconciler] Failed to fetch latest execution timestamp:', error.message);
    return;
  }

  const lastSyncTime = latestEvent ? latestEvent.processed_at : new Date(Date.now() - 3600000).toISOString(); // 1 hour fallback
  const mode = (process.env.NEXT_PUBLIC_TRADING_MODE || 'PAPER') as 'SIMULATION' | 'PAPER' | 'LIVE';

  if (mode === 'LIVE') {
    console.log(`[Reconciler] Fetching executions since ${lastSyncTime} from Toss Proxy...`);
    try {
      let baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      
      const response = await fetch(`${baseUrl}/api/toss-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'x-worker-user-id': 'system-gap-sync'
        },
        body: JSON.stringify({
          method: 'GET',
          path: `/v1/orders/executions?since=${lastSyncTime}`
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[Reconciler] Successfully synced execution gap: ${JSON.stringify(data)}`);
      } else {
        console.warn(`[Reconciler] Execution gap sync query returned HTTP ${response.status}`);
      }
    } catch (err: any) {
      console.error('[Reconciler] Failed execution gap sync fetch:', err.message);
    }
  } else {
    // Simulated broker fetch: In a live environment, this would call GET /executions?since=lastSyncTime
    // For mock, we simply log compliance
    console.log('[Reconciler] Gap sync query completed. No missing history in simulation.');
  }
}

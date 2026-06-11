import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { TradingService } from './interface';
import { RiskEngine } from '../risk/risk-engine';
import { MarketDataProvider } from '../market/interface';
import { MockMarketDataProvider } from '../market/mock-market-data-provider';
import { 
  OrderRequest, 
  OrderResponse, 
  Position, 
  AccountBalance, 
  OrderV2 
} from '../../types/trading';
import { TradeIntent } from '../../types/strategy';

export class PaperTradingService implements TradingService {
  private supabase: SupabaseClient;
  private riskEngine: RiskEngine;
  private marketData: MarketDataProvider;

  constructor(supabase: SupabaseClient, riskEngine?: RiskEngine, marketData?: MarketDataProvider) {
    this.supabase = supabase;
    this.riskEngine = riskEngine || new RiskEngine(supabase);
    this.marketData = marketData || new MockMarketDataProvider();
  }

  async placeOrder(request: OrderRequest, clientOrderId?: string): Promise<OrderResponse> {
    const { data: { user }, error: authError } = await this.supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Unauthorized: Authentication required.' };
    }

    const cid = clientOrderId || `ORD-PAPER-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // If it's a MARKET order, fetch current price if missing
    let intentPrice = request.price;
    if (!intentPrice || request.type === 'MARKET') {
      intentPrice = await this.marketData.getPrice(request.symbol);
    }

    const intent: TradeIntent = {
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      qty: request.qty,
      price: intentPrice,
      clientOrderId: cid
    };

    // 1. Enforce Risk Engine Validation BEFORE order persistence or broker simulation
    const validation = await this.riskEngine.validate(intent, user.id);
    if (!validation.isValid) {
      // Persist directly to DB as REJECTED to maintain auditability of risk failures
      const { error: rejectInsertError } = await this.supabase
        .from('orders')
        .insert({
          client_order_id: cid,
          user_id: user.id,
          symbol: request.symbol,
          side: request.side,
          type: request.type,
          qty: request.qty,
          price: intentPrice || 0,
          status: 'REJECTED',
          filled_qty: 0,
          avg_fill_price: 0,
          trading_mode: 'PAPER',
          last_sequence_number: 0,
          error_message: validation.rejectionReason || 'Rejected by Risk Engine'
        });

      if (rejectInsertError) {
        console.error(`[PaperTradingService] Failed to insert rejected order: ${rejectInsertError.message}`);
      }

      return { success: false, error: validation.rejectionReason || 'Rejected by Risk Engine' };
    }

    // 2. Persist initial order record in PENDING state (Broker Mapping constraint)
    const { error: insertError } = await this.supabase
      .from('orders')
      .insert({
        client_order_id: cid,
        user_id: user.id,
        symbol: request.symbol,
        side: request.side,
        type: request.type,
        qty: request.qty,
        price: intentPrice,
        status: 'PENDING',
        filled_qty: 0,
        avg_fill_price: 0,
        trading_mode: 'PAPER',
        last_sequence_number: 0
      });

    if (insertError) {
      return { success: false, error: `Failed to insert order: ${insertError.message}` };
    }

    // 3. Transition to SUBMITTED state before fill simulation
    await this.supabase.rpc('update_order_status_v2', {
      p_client_order_id: cid,
      p_status: 'SUBMITTED'
    });

    // 4. Simulate fill (Synchronously awaited to survive serverless environments)
    await this._simulateFill(user.id, intent);

    return { 
      success: true, 
      order: {
        id: cid,
        symbol: request.symbol,
        side: request.side,
        type: request.type,
        qty: request.qty,
        price: intentPrice,
        status: 'SUBMITTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  }

  async cancelOrder(clientOrderId: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('cancel_trade_v2', {
      p_client_order_id: clientOrderId
    });

    if (error) {
      console.error(`Cancel Order Failed for ${clientOrderId}:`, error);
      return false;
    }

    return !!data?.success;
  }

  async getPositions(): Promise<Position[]> {
    const { data, error } = await this.supabase.from('positions').select('*');
    if (error || !data) return [];
    
    // Enrich with dynamic market data
    const enriched = await Promise.all(data.map(async (p) => {
      const currentPrice = await this.marketData.getPrice(p.symbol);
      return {
        id: p.id,
        symbol: p.symbol,
        qty: p.qty,
        avgBuyPrice: p.avg_buy_price,
        currentPrice: currentPrice
      };
    }));

    return enriched;
  }

  async getAccountBalance(): Promise<AccountBalance> {
    const { data, error } = await this.supabase.from('portfolio').select('*').single();
    if (error || !data) return { cashBalance: 0, purchasingPower: 0, totalPortfolioValue: 0, unrealizedPnL: 0 };
    
    const cashBalance = Number(data.cash_balance) || 0;
    
    // Fetch all positions to calculate accurate Mark-to-Market net asset value
    const positions = await this.getPositions();
    let positionsValue = 0;
    let unrealizedPnL = 0;

    for (const p of positions) {
      const positionValue = p.qty * p.currentPrice;
      const costBasis = p.qty * p.avgBuyPrice;
      positionsValue += positionValue;
      unrealizedPnL += (positionValue - costBasis);
    }

    return {
      cashBalance,
      purchasingPower: cashBalance,
      totalPortfolioValue: cashBalance + positionsValue,
      unrealizedPnL
    };
  }

  async getOrder(clientOrderId: string): Promise<OrderV2 | null> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*')
      .eq('client_order_id', clientOrderId)
      .single();

    if (error || !data) return null;
    return data as OrderV2;
  }

  async fetchOrderFromBroker(clientOrderId: string): Promise<OrderV2 | null> {
    // For Paper/Simulation, the local orders table functions as the mock broker's ledger
    return this.getOrder(clientOrderId);
  }

  /**
   * Private simulator method to mock broker network latency and fill.
   */
  private async _simulateFill(userId: string, intent: TradeIntent) {
    try {
      // Simulate 50ms - 200ms latency
      const delay = Math.floor(Math.random() * 150) + 50;
      await new Promise(resolve => setTimeout(resolve, delay));

      const executionId = `EXEC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      // Fetch instantaneous execution price at time of fill
      const executionPrice = await this.marketData.getPrice(intent.symbol);
      const intentPrice = intent.price || executionPrice;

      // Order Matching Rules & Slippage Tolerance
      if (intent.type === 'LIMIT') {
        if (intent.side === 'BUY' && executionPrice > intentPrice) {
          console.log(`[LIMIT BUY] Unfilled. ExecPrice ${executionPrice} > IntentPrice ${intentPrice}. Remaining SUBMITTED.`);
          return;
        }
        if (intent.side === 'SELL' && executionPrice < intentPrice) {
          console.log(`[LIMIT SELL] Unfilled. ExecPrice ${executionPrice} < IntentPrice ${intentPrice}. Remaining SUBMITTED.`);
          return;
        }
      } else if (intent.type === 'MARKET') {
        if (intent.side === 'BUY' && executionPrice > intentPrice * 1.05) {
          throw new Error(`Slippage tolerance exceeded. ExecPrice ${executionPrice} > IntentPrice ${intentPrice} * 1.05.`);
        }
        if (intent.side === 'SELL' && executionPrice < intentPrice * 0.95) {
          throw new Error(`Slippage tolerance exceeded. ExecPrice ${executionPrice} < IntentPrice ${intentPrice} * 0.95.`);
        }
      }

      const payload = {
        simulated: true,
        timestamp: new Date().toISOString()
      };

      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const client = serviceRoleKey
        ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
        : this.supabase;

      // Call execute_trade_v2 to securely commit to ledgers
      const { error } = await client.rpc('execute_trade_v2', {
        p_execution_id: executionId,
        p_client_order_id: intent.clientOrderId,
        p_fill_qty: intent.qty,
        p_fill_price: executionPrice,
        p_sequence_number: 1,
        p_raw_payload: payload
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error(`Paper Simulation Failed for ${intent.clientOrderId}:`, err);
      // Fallback: Transition stuck order to REJECTED
      await this.supabase.rpc('update_order_status_v2', {
        p_client_order_id: intent.clientOrderId,
        p_status: 'REJECTED',
        p_error_message: err.message || 'Simulation execution failed'
      });
    }
  }

  async getMarketPrice(symbol: string): Promise<number> {
    return this.marketData.getPrice(symbol);
  }
}

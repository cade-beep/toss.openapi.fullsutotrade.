import { SupabaseClient } from '@supabase/supabase-js';
import { TradeIntent, RiskValidationResult } from '../../types/strategy';
import { MarketDataProvider } from '../market/interface';
import { MockMarketDataProvider } from '../market/mock-market-data-provider';
import { RiskProfile } from '../../types/risk';

export class RiskEngine {
  private supabase: SupabaseClient;
  private marketData: MarketDataProvider;

  constructor(supabase: SupabaseClient, marketData?: MarketDataProvider) {
    this.supabase = supabase;
    this.marketData = marketData || new MockMarketDataProvider();
  }

  /**
   * Private helper to retrieve or initialize the start of day portfolio value snapshot.
   */
  private async getOrInitializeStartOfDayValue(userId: string, currentTotalValue: number): Promise<number> {
    // Correctly localize date boundary to Asia/Seoul (KST)
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Seoul', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    const today = formatter.format(new Date());
    
    const { data, error } = await this.supabase
      .from('daily_portfolio_snapshots')
      .select('start_of_day_portfolio_value')
      .eq('user_id', userId)
      .eq('snapshot_date', today)
      .single();

    if (error && error.code === 'PGRST116') {
      const { error: insertError } = await this.supabase
        .from('daily_portfolio_snapshots')
        .insert({
          user_id: userId,
          snapshot_date: today,
          start_of_day_portfolio_value: currentTotalValue
        });

      if (!insertError) {
        return currentTotalValue;
      }
    }

    return data?.start_of_day_portfolio_value || currentTotalValue;
  }

  /**
   * Validates a trade intent against current balance and risk limits.
   */
  async validate(intent: TradeIntent, userId: string): Promise<RiskValidationResult> {
    if (intent.qty <= 0) {
      return { isValid: false, rejectionReason: 'Quantity must be greater than zero.' };
    }

    // Load user's risk profile from DB
    const { data: profile, error: profileError } = await this.supabase
      .from('risk_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch risk profile: ${profileError.message}`);
    }

    // Fallback default config if none is seeded in Supabase
    const config: RiskProfile = profile || {
      user_id: userId,
      max_open_positions: 5,
      max_position_size_value: 10000000,
      max_order_value: 5000000,
      max_symbol_exposure_pct: 30.00,
      max_portfolio_exposure_pct: 100.00,
      daily_loss_limit: 1000000,
      kill_switch_active: false,
      max_trades_per_minute: 10,
      min_ai_confidence: 0.70,
      updated_at: new Date().toISOString()
    };

    const isBuy = intent.side === 'BUY';
    const isSell = intent.side === 'SELL';

    // 1. Emergency Kill Switch (Only halts BUYs, allows liquidations)
    if (config.kill_switch_active && isBuy) {
      return { isValid: false, rejectionReason: 'Emergency Kill Switch is active. All buy orders are halted.' };
    }

    // 2. Trade Frequency Limits (Rate Limiting checks all orders)
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count, error: countError } = await this.supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('created_at', oneMinuteAgo);

    if (countError) {
      throw new Error(`Failed to check order frequency: ${countError.message}`);
    }

    if (count !== null && count >= config.max_trades_per_minute) {
      return { isValid: false, rejectionReason: `Trade frequency limit exceeded. Maximum is ${config.max_trades_per_minute} trades per minute.` };
    }

    // Fetch instantaneous market price of the symbol
    const currentMarketPrice = await this.marketData.getPrice(intent.symbol);
    const intentPrice = intent.price || currentMarketPrice;
    const orderValue = intent.qty * intentPrice;

    // 3. Max Order Size
    if (orderValue > config.max_order_value) {
      return { isValid: false, rejectionReason: `Order value (${orderValue} KRW) exceeds maximum order size limit (${config.max_order_value} KRW).` };
    }

    // 4. AI Strategy Risk Controls
    if (intent.isAI || intent.aiConfidence !== undefined) {
      const confidence = intent.aiConfidence ?? 0;
      if (confidence < config.min_ai_confidence) {
        return { isValid: false, rejectionReason: `AI strategy confidence (${confidence}) is below the required minimum threshold of ${config.min_ai_confidence}.` };
      }
    }

    // Fetch user cash balance
    const { data: portfolio, error: portfolioError } = await this.supabase
      .from('portfolio_state')
      .select('cash_balance')
      .eq('user_id', userId)
      .single();

    if (portfolioError && portfolioError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch portfolio state: ${portfolioError.message}`);
    }

    const cashBalance = portfolio?.cash_balance || 0;

    // Fetch existing position size
    const { data: position, error: positionError } = await this.supabase
      .from('position_state')
      .select('qty, avg_buy_price')
      .eq('user_id', userId)
      .eq('symbol', intent.symbol)
      .single();

    if (positionError && positionError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch position state: ${positionError.message}`);
    }

    const positionQty = Number(position?.qty) || 0;

    // Fetch all currently open positions to aggregate portfolio exposure
    const { data: openPositions, error: openPositionsError } = await this.supabase
      .from('position_state')
      .select('symbol, qty')
      .eq('user_id', userId)
      .gt('qty', 0);

    if (openPositionsError) {
      throw new Error(`Failed to fetch open positions: ${openPositionsError.message}`);
    }

    // Fetch pending orders to calculate projected commitments
    const { data: pendingOrders, error: pendingOrdersError } = await this.supabase
      .from('orders')
      .select('symbol, side, qty, filled_qty, price')
      .eq('user_id', userId)
      .in('status', ['PENDING', 'SUBMITTED', 'PARTIALLY_FILLED']);

    if (pendingOrdersError) {
      throw new Error(`Failed to fetch pending orders: ${pendingOrdersError.message}`);
    }

    // Calculate pending cash commitment and position adjustments
    let pendingCashCommitment = 0;
    const pendingQtyChanges: Record<string, number> = {};

    for (const ord of pendingOrders || []) {
      const remainingQty = Number(ord.qty) - Number(ord.filled_qty);
      if (remainingQty <= 0) continue;

      if (ord.side === 'BUY') {
        const priceVal = ord.price || await this.marketData.getPrice(ord.symbol);
        pendingCashCommitment += remainingQty * priceVal;

        pendingQtyChanges[ord.symbol] = (pendingQtyChanges[ord.symbol] || 0) + remainingQty;
      } else if (ord.side === 'SELL') {
        pendingQtyChanges[ord.symbol] = (pendingQtyChanges[ord.symbol] || 0) - remainingQty;
      }
    }

    // Projected states for concurrency-safe checks
    const projectedCashBalance = cashBalance - pendingCashCommitment;
    const projectedPositionQty = positionQty + (pendingQtyChanges[intent.symbol] || 0);

    let totalPositionsValue = 0;
    const positionsList = openPositions || [];
    const activeSymbols = new Set<string>();

    for (const pos of positionsList) {
      const price = await this.marketData.getPrice(pos.symbol);
      totalPositionsValue += Number(pos.qty) * price;
      if (Number(pos.qty) > 0) {
        activeSymbols.add(pos.symbol);
      }
    }

    // Include any symbols that will become active due to pending BUYs
    for (const symbol in pendingQtyChanges) {
      if (pendingQtyChanges[symbol] > 0) {
        activeSymbols.add(symbol);
      }
    }

    const currentTotalValue = cashBalance + totalPositionsValue;

    if (isBuy) {
      // Verify projected cash balance sufficiency (safe against parallel order placement)
      if (projectedCashBalance < orderValue) {
        return { 
          isValid: false, 
          rejectionReason: `Insufficient funds (including pending orders). Cost: ${orderValue}, Projected Available: ${projectedCashBalance}` 
        };
      }

      // 5. Position Limits (Max open positions count)
      const currentOpenPositionsCount = activeSymbols.size;
      const isNewSymbol = !activeSymbols.has(intent.symbol);
      if (isNewSymbol && currentOpenPositionsCount >= config.max_open_positions) {
        return { isValid: false, rejectionReason: `Position limits exceeded. Maximum open positions allowed: ${config.max_open_positions}.` };
      }

      // 6. Max Position Size (Limit per position value)
      const projectedTotalQty = projectedPositionQty + intent.qty;
      const projectedPositionValue = projectedTotalQty * currentMarketPrice;
      if (projectedPositionValue > config.max_position_size_value) {
        return { isValid: false, rejectionReason: `Projected position value (${projectedPositionValue} KRW) exceeds maximum allowed position size (${config.max_position_size_value} KRW).` };
      }

      // 7. Symbol Exposure Limits
      const symbolExposurePct = (projectedPositionValue / currentTotalValue) * 100;
      if (symbolExposurePct > config.max_symbol_exposure_pct) {
        return { isValid: false, rejectionReason: `Symbol exposure (${symbolExposurePct.toFixed(2)}%) exceeds maximum limit of ${config.max_symbol_exposure_pct}%.` };
      }

      // 8. Portfolio Exposure Limits
      // Include pending commitments in overall exposure
      let totalProjectedPositionsValue = totalPositionsValue + orderValue;
      for (const symbol in pendingQtyChanges) {
        if (pendingQtyChanges[symbol] > 0 && symbol !== intent.symbol) {
          const price = await this.marketData.getPrice(symbol);
          totalProjectedPositionsValue += pendingQtyChanges[symbol] * price;
        }
      }
      const portfolioExposurePct = (totalProjectedPositionsValue / currentTotalValue) * 100;
      if (portfolioExposurePct > config.max_portfolio_exposure_pct) {
        return { isValid: false, rejectionReason: `Total portfolio exposure (${portfolioExposurePct.toFixed(2)}%) exceeds maximum limit of ${config.max_portfolio_exposure_pct}%.` };
      }

      // 9. Daily Loss Limits
      const startOfDayValue = await this.getOrInitializeStartOfDayValue(userId, currentTotalValue);
      const dailyLoss = startOfDayValue - currentTotalValue;
      if (dailyLoss >= config.daily_loss_limit) {
        return { isValid: false, rejectionReason: `Daily loss limit breached. Loss: ${dailyLoss} KRW, Limit: ${config.daily_loss_limit} KRW.` };
      }
    } else if (isSell) {
      // Check projected share sufficiency for selling
      const projectedAvailableShares = positionQty + (pendingQtyChanges[intent.symbol] || 0);
      if (projectedAvailableShares < intent.qty) {
        return { 
          isValid: false, 
          rejectionReason: `Insufficient shares (accounting for pending orders). Requested: ${intent.qty}, Projected Available: ${projectedAvailableShares}` 
        };
      }
    }

    return { isValid: true };
  }
}

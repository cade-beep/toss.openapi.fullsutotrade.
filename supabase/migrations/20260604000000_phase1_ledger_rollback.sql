-- Revert Phase 1 Data Layer Changes

-- 1. Drop the views and triggers
DROP TRIGGER IF EXISTS portfolio_view_insert ON public.portfolio;
DROP FUNCTION IF EXISTS public.portfolio_insert_handler();

DROP VIEW IF EXISTS public.portfolio;
DROP VIEW IF EXISTS public.positions;
DROP VIEW IF EXISTS public.orders_log;

-- 2. Drop the new RPCs
DROP FUNCTION IF EXISTS public.execute_trade_v2;
DROP FUNCTION IF EXISTS public.cancel_trade_v2;
DROP FUNCTION IF EXISTS public.execute_trade;

-- 3. Restore the original execute_trade RPC (From init_schema)
CREATE OR REPLACE FUNCTION public.execute_trade(
  p_order_id varchar(50),
  p_symbol varchar(10),
  p_side varchar(10),
  p_qty integer,
  p_price integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_total_cost bigint;
  v_cash_balance bigint;
  v_current_qty integer;
  v_new_qty integer;
  v_avg_buy_price numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authentication required.';
  END IF;

  v_total_cost := p_qty::bigint * p_price::bigint;

  -- Lock portfolio
  SELECT cash_balance INTO v_cash_balance
  FROM public.portfolio_legacy
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_cash_balance IS NULL THEN
    v_cash_balance := 0;
  END IF;

  -- Lock positions
  SELECT qty, avg_buy_price INTO v_current_qty, v_avg_buy_price
  FROM public.positions_legacy
  WHERE user_id = v_user_id AND symbol = p_symbol
  FOR UPDATE;

  IF v_current_qty IS NULL THEN
    v_current_qty := 0;
    v_avg_buy_price := 0;
  END IF;

  IF p_side = 'BUY' THEN
    IF v_cash_balance < v_total_cost THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;

    UPDATE public.portfolio_legacy
    SET cash_balance = cash_balance - v_total_cost, updated_at = now()
    WHERE user_id = v_user_id;

    v_new_qty := v_current_qty + p_qty;
    v_avg_buy_price := round((v_current_qty * v_avg_buy_price + v_total_cost) / v_new_qty);

    INSERT INTO public.positions_legacy (user_id, symbol, qty, avg_buy_price)
    VALUES (v_user_id, p_symbol, v_new_qty, v_avg_buy_price)
    ON CONFLICT (user_id, symbol) DO UPDATE
    SET qty = EXCLUDED.qty, avg_buy_price = EXCLUDED.avg_buy_price, updated_at = now();

  ELSIF p_side = 'SELL' THEN
    IF v_current_qty < p_qty THEN
      RAISE EXCEPTION 'Insufficient shares';
    END IF;

    UPDATE public.portfolio_legacy
    SET cash_balance = cash_balance + v_total_cost, updated_at = now()
    WHERE user_id = v_user_id;

    v_new_qty := v_current_qty - p_qty;

    IF v_new_qty = 0 THEN
      DELETE FROM public.positions_legacy WHERE user_id = v_user_id AND symbol = p_symbol;
    ELSE
      UPDATE public.positions_legacy
      SET qty = v_new_qty, updated_at = now()
      WHERE user_id = v_user_id AND symbol = p_symbol;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid trade side';
  END IF;

  INSERT INTO public.orders_legacy (
    id, user_id, symbol, side, type, qty, price, status
  ) VALUES (
    p_order_id, v_user_id, p_symbol, p_side, 'MARKET', p_qty, p_price, 'FILLED'
  );

  RETURN json_build_object(
    'success', true,
    'order_id', p_order_id,
    'side', p_side,
    'qty', p_qty,
    'price', p_price
  );
END;
$$;

-- 4. Backport Data from State tables to Legacy tables to prevent data loss
DO $$
BEGIN
  -- Backport Portfolio Cash Balances
  UPDATE public.portfolio_legacy pl
  SET cash_balance = ps.cash_balance,
      updated_at = ps.updated_at
  FROM public.portfolio_state ps
  WHERE pl.user_id = ps.user_id;
  
  -- Insert missing Portfolios if any were created during V2
  INSERT INTO public.portfolio_legacy (user_id, cash_balance, updated_at)
  SELECT user_id, cash_balance, updated_at FROM public.portfolio_state
  ON CONFLICT (user_id) DO NOTHING;

  -- Backport Positions
  UPDATE public.positions_legacy pl
  SET qty = ps.qty,
      avg_buy_price = ps.avg_buy_price,
      updated_at = ps.updated_at
  FROM public.position_state ps
  WHERE pl.user_id = ps.user_id AND pl.symbol = ps.symbol;
  
  -- Insert missing Positions if any were created during V2
  INSERT INTO public.positions_legacy (user_id, symbol, qty, avg_buy_price, updated_at)
  SELECT user_id, symbol, qty, avg_buy_price, updated_at FROM public.position_state
  ON CONFLICT (user_id, symbol) DO NOTHING;
  
  -- Delete empty positions from legacy
  DELETE FROM public.positions_legacy WHERE qty <= 0;

  -- Backport Orders
  INSERT INTO public.orders_legacy (id, user_id, symbol, side, type, qty, price, status, created_at)
  SELECT client_order_id, user_id, symbol, side, type, qty, price, status, created_at FROM public.orders
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- 5. Drop the new tables and types
DROP TABLE IF EXISTS public.order_audit_trail CASCADE;
DROP TABLE IF EXISTS public.broker_execution_events CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.position_ledger CASCADE;
DROP TABLE IF EXISTS public.portfolio_ledger CASCADE;
DROP TABLE IF EXISTS public.portfolio_state CASCADE;
DROP TABLE IF EXISTS public.position_state CASCADE;

DROP TYPE IF EXISTS public.order_status_v2;

-- 6. Restore original table names
ALTER TABLE public.portfolio_legacy RENAME TO portfolio;
ALTER TABLE public.positions_legacy RENAME TO positions;
ALTER TABLE public.orders_legacy RENAME TO orders_log;

-- Revert policies names back
ALTER POLICY "Users can view their own portfolio_legacy" ON public.portfolio RENAME TO "Users can view their own portfolio";
ALTER POLICY "Users can insert their own portfolio_legacy" ON public.portfolio RENAME TO "Users can insert their own portfolio";
ALTER POLICY "Users can update their own portfolio_legacy" ON public.portfolio RENAME TO "Users can update their own portfolio";

ALTER POLICY "Users can view their own positions_legacy" ON public.positions RENAME TO "Users can view their own positions";
ALTER POLICY "Users can insert their own positions_legacy" ON public.positions RENAME TO "Users can insert their own positions";
ALTER POLICY "Users can update their own positions_legacy" ON public.positions RENAME TO "Users can update their own positions";
ALTER POLICY "Users can delete their own positions_legacy" ON public.positions RENAME TO "Users can delete their own positions";

ALTER POLICY "Users can view their own orders_legacy" ON public.orders_log RENAME TO "Users can view their own orders";
ALTER POLICY "Users can insert their own orders_legacy" ON public.orders_log RENAME TO "Users can insert their own orders";


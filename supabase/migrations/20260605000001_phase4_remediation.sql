-- 1. Recreate execute_trade_v2 with strict checks, locks, and service_role support
CREATE OR REPLACE FUNCTION public.execute_trade_v2(
  p_execution_id varchar(100),
  p_client_order_id varchar(100),
  p_fill_qty numeric(12, 4),
  p_fill_price numeric(16, 4),
  p_sequence_number bigint,
  p_raw_payload jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_symbol varchar(10);
  v_side varchar(10);
  v_current_status public.order_status_v2;
  v_total_cost bigint;
  v_cash_balance bigint;
  v_current_qty numeric;
  v_avg_buy_price numeric;
  v_new_qty numeric;
BEGIN
  -- Identify the user by checking the order record (supports service_role)
  SELECT user_id, symbol, side, status 
  INTO v_user_id, v_symbol, v_side, v_current_status
  FROM public.orders WHERE client_order_id = p_client_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  -- Authorization validation check: Only allow service_role OR the user themselves
  IF current_setting('role', true) != 'service_role' THEN
    IF auth.uid() IS NULL OR auth.uid() != v_user_id THEN
      RAISE EXCEPTION 'Unauthorized: Access denied.';
    END IF;
  END IF;

  -- Serialize portfolio operations for safety
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text)::bigint);

  IF EXISTS (SELECT 1 FROM public.broker_execution_events WHERE execution_id = p_execution_id) THEN
    RETURN json_build_object('success', true, 'message', 'Execution already processed.', 'execution_id', p_execution_id);
  END IF;

  v_total_cost := (p_fill_qty * p_fill_price)::bigint;

  -- Read state
  SELECT cash_balance INTO v_cash_balance FROM public.portfolio_state WHERE user_id = v_user_id;
  SELECT qty, avg_buy_price INTO v_current_qty, v_avg_buy_price FROM public.position_state WHERE user_id = v_user_id AND symbol = v_symbol;
  IF v_current_qty IS NULL THEN v_current_qty := 0; v_avg_buy_price := 0; END IF;
  IF v_cash_balance IS NULL THEN v_cash_balance := 0; END IF;

  -- Database Cash Sufficiency Check (Strict transaction guard)
  IF v_side = 'BUY' THEN
    IF v_cash_balance < v_total_cost THEN
      RAISE EXCEPTION 'Insufficient balance: cash balance is %, purchase cost is %.', v_cash_balance, v_total_cost;
    END IF;

    INSERT INTO public.portfolio_ledger (user_id, amount, reference_id) VALUES (v_user_id, -v_total_cost, p_execution_id);
    INSERT INTO public.position_ledger (user_id, symbol, qty_change, price, reference_id) VALUES (v_user_id, v_symbol, p_fill_qty, p_fill_price, p_execution_id);
    
    v_new_qty := v_current_qty + p_fill_qty;
    v_avg_buy_price := round((v_current_qty * v_avg_buy_price + v_total_cost) / v_new_qty);

    INSERT INTO public.portfolio_state (user_id, cash_balance) VALUES (v_user_id, v_cash_balance - v_total_cost)
    ON CONFLICT (user_id) DO UPDATE SET cash_balance = EXCLUDED.cash_balance, updated_at = now();

    INSERT INTO public.position_state (user_id, symbol, qty, avg_buy_price) VALUES (v_user_id, v_symbol, v_new_qty, v_avg_buy_price)
    ON CONFLICT (user_id, symbol) DO UPDATE SET qty = EXCLUDED.qty, avg_buy_price = EXCLUDED.avg_buy_price, updated_at = now();

  ELSIF v_side = 'SELL' THEN
    IF v_current_qty < p_fill_qty THEN
      RAISE EXCEPTION 'Insufficient shares: owned %, requested fill is %.', v_current_qty, p_fill_qty;
    END IF;

    INSERT INTO public.portfolio_ledger (user_id, amount, reference_id) VALUES (v_user_id, v_total_cost, p_execution_id);
    INSERT INTO public.position_ledger (user_id, symbol, qty_change, price, reference_id) VALUES (v_user_id, v_symbol, -p_fill_qty, p_fill_price, p_execution_id);

    v_new_qty := v_current_qty - p_fill_qty;

    INSERT INTO public.portfolio_state (user_id, cash_balance) VALUES (v_user_id, v_cash_balance + v_total_cost)
    ON CONFLICT (user_id) DO UPDATE SET cash_balance = EXCLUDED.cash_balance, updated_at = now();

    INSERT INTO public.position_state (user_id, symbol, qty, avg_buy_price) VALUES (v_user_id, v_symbol, v_new_qty, v_avg_buy_price)
    ON CONFLICT (user_id, symbol) DO UPDATE SET qty = EXCLUDED.qty, updated_at = now();
  END IF;

  INSERT INTO public.broker_execution_events (
    execution_id, client_order_id, broker_order_id, event_type, sequence_number, filled_qty, execution_price, raw_payload
  ) VALUES (
    p_execution_id, p_client_order_id, COALESCE((SELECT broker_order_id FROM public.orders WHERE client_order_id = p_client_order_id), 'mock_id'), 
    'PARTIAL_FILL', p_sequence_number, p_fill_qty, p_fill_price, p_raw_payload
  );

  UPDATE public.orders
  SET filled_qty = filled_qty + p_fill_qty,
      avg_fill_price = round((filled_qty * avg_fill_price + v_total_cost) / (filled_qty + p_fill_qty)),
      status = CASE WHEN (filled_qty + p_fill_qty) >= qty THEN 'FILLED'::public.order_status_v2 ELSE 'PARTIALLY_FILLED'::public.order_status_v2 END,
      last_sequence_number = p_sequence_number,
      updated_at = now()
  WHERE client_order_id = p_client_order_id;

  RETURN json_build_object('success', true, 'client_order_id', p_client_order_id);
END;
$$;

-- 2. Recreate cancel_trade_v2 with search_path and authentication validations
CREATE OR REPLACE FUNCTION public.cancel_trade_v2(
  p_client_order_id varchar(100)
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_user_id uuid;
  v_current_status public.order_status_v2;
  v_broker_order_id varchar(100);
  v_last_sequence_number bigint;
BEGIN
  -- Identify the user by checking the order record (supports service_role)
  SELECT user_id, status, broker_order_id, last_sequence_number 
  INTO v_user_id, v_current_status, v_broker_order_id, v_last_sequence_number
  FROM public.orders 
  WHERE client_order_id = p_client_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  -- Authorization validation check: Only allow service_role OR the user themselves
  IF current_setting('role', true) != 'service_role' THEN
    IF auth.uid() IS NULL OR auth.uid() != v_user_id THEN
      RAISE EXCEPTION 'Unauthorized: Access denied.';
    END IF;
  END IF;

  -- Serialize portfolio operations for safety
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text)::bigint);

  IF v_current_status NOT IN ('PENDING', 'SUBMITTED', 'PARTIALLY_FILLED') THEN
    RAISE EXCEPTION 'Order cannot be cancelled in its current state: %', v_current_status;
  END IF;

  INSERT INTO public.broker_execution_events (
    execution_id, client_order_id, broker_order_id, event_type, sequence_number, filled_qty, execution_price, raw_payload
  ) VALUES (
    'EXEC-CANCEL-' || floor(extract(epoch from now()) * 1000)::text,
    p_client_order_id, 
    COALESCE(v_broker_order_id, 'mock_id'), 
    'CANCEL', 
    v_last_sequence_number + 1, 
    0, 
    0, 
    jsonb_build_object('reason', 'User requested cancellation')
  );

  UPDATE public.orders
  SET status = 'CANCELLED',
      updated_at = now()
  WHERE client_order_id = p_client_order_id;

  RETURN json_build_object('success', true, 'client_order_id', p_client_order_id, 'status', 'CANCELLED');
END;
$body$;

-- 3. Revoke public execute rights on the fill matching RPC
REVOKE EXECUTE ON FUNCTION public.execute_trade_v2(varchar, varchar, numeric, numeric, bigint, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_trade_v2(varchar, varchar, numeric, numeric, bigint, jsonb) TO service_role;

-- Recreate execute_trade_v2 to support all event types and strict sequence checks
CREATE OR REPLACE FUNCTION public.execute_trade_v2(
  p_execution_id varchar(100),
  p_client_order_id varchar(100),
  p_event_type varchar(20), -- 'ACK', 'PARTIAL_FILL', 'FULL_FILL', 'CANCEL', 'REJECT'
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
  v_last_sequence_number bigint;
  v_qty numeric(12, 4);
  v_filled_qty numeric(12, 4);
  v_avg_fill_price numeric(16, 4);
  v_total_cost bigint;
  v_cash_balance bigint;
  v_current_qty numeric;
  v_avg_buy_price numeric;
  v_new_qty numeric;
BEGIN
  -- 1. Lock the order and retrieve parameters
  SELECT user_id, symbol, side, status, last_sequence_number, qty, filled_qty, avg_fill_price
  INTO v_user_id, v_symbol, v_side, v_current_status, v_last_sequence_number, v_qty, v_filled_qty, v_avg_fill_price
  FROM public.orders WHERE client_order_id = p_client_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  -- 2. Enforce sequence check
  IF p_sequence_number <= v_last_sequence_number THEN
    RETURN json_build_object('success', true, 'message', 'Stale event discarded.', 'sequence_number', p_sequence_number);
  END IF;

  -- 3. Terminal state guard
  IF v_current_status IN ('FILLED', 'CANCELLED', 'REJECTED') THEN
    RAISE EXCEPTION 'Cannot update order in terminal state: %', v_current_status;
  END IF;

  -- 4. Advisory lock on user's portfolio
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text)::bigint);

  -- 5. Duplicate check
  IF EXISTS (SELECT 1 FROM public.broker_execution_events WHERE execution_id = p_execution_id) THEN
    RETURN json_build_object('success', true, 'message', 'Execution already processed.', 'execution_id', p_execution_id);
  END IF;

  -- 6. Event Branching
  IF p_event_type = 'ACK' THEN
    UPDATE public.orders
    SET status = 'SUBMITTED', last_sequence_number = p_sequence_number, updated_at = now()
    WHERE client_order_id = p_client_order_id;

  ELSIF p_event_type IN ('PARTIAL_FILL', 'FULL_FILL') THEN
    v_total_cost := (p_fill_qty * p_fill_price)::bigint;
    SELECT cash_balance INTO v_cash_balance FROM public.portfolio_state WHERE user_id = v_user_id;
    SELECT qty, avg_buy_price INTO v_current_qty, v_avg_buy_price FROM public.position_state WHERE user_id = v_user_id AND symbol = v_symbol;
    IF v_current_qty IS NULL THEN v_current_qty := 0; v_avg_buy_price := 0; END IF;
    IF v_cash_balance IS NULL THEN v_cash_balance := 0; END IF;

    IF v_side = 'BUY' THEN
      IF v_cash_balance < v_total_cost THEN
        RAISE EXCEPTION 'Insufficient balance: cash balance is %, purchase cost is %.', v_cash_balance, v_total_cost;
      END IF;
      INSERT INTO public.portfolio_ledger (user_id, amount, reference_id) VALUES (v_user_id, -v_total_cost, p_execution_id);
      INSERT INTO public.position_ledger (user_id, symbol, qty_change, price, reference_id) VALUES (v_user_id, v_symbol, p_fill_qty, p_fill_price, p_execution_id);
      v_new_qty := v_current_qty + p_fill_qty;
      v_avg_buy_price := round((v_current_qty * v_avg_buy_price + v_total_cost) / v_new_qty);
      INSERT INTO public.portfolio_state (user_id, cash_balance) VALUES (v_user_id, v_cash_balance - v_total_cost) ON CONFLICT (user_id) DO UPDATE SET cash_balance = EXCLUDED.cash_balance, updated_at = now();
      INSERT INTO public.position_state (user_id, symbol, qty, avg_buy_price) VALUES (v_user_id, v_symbol, v_new_qty, v_avg_buy_price) ON CONFLICT (user_id, symbol) DO UPDATE SET qty = EXCLUDED.qty, avg_buy_price = EXCLUDED.avg_buy_price, updated_at = now();
    ELSE
      IF v_current_qty < p_fill_qty THEN
        RAISE EXCEPTION 'Insufficient shares: owned %, requested fill is %.', v_current_qty, p_fill_qty;
      END IF;
      INSERT INTO public.portfolio_ledger (user_id, amount, reference_id) VALUES (v_user_id, v_total_cost, p_execution_id);
      INSERT INTO public.position_ledger (user_id, symbol, qty_change, price, reference_id) VALUES (v_user_id, v_symbol, -p_fill_qty, p_fill_price, p_execution_id);
      v_new_qty := v_current_qty - p_fill_qty;
      INSERT INTO public.portfolio_state (user_id, cash_balance) VALUES (v_user_id, v_cash_balance + v_total_cost) ON CONFLICT (user_id) DO UPDATE SET cash_balance = EXCLUDED.cash_balance, updated_at = now();
      INSERT INTO public.position_state (user_id, symbol, qty, avg_buy_price) VALUES (v_user_id, v_symbol, v_new_qty, v_avg_buy_price) ON CONFLICT (user_id, symbol) DO UPDATE SET qty = EXCLUDED.qty, updated_at = now();
    END IF;

    UPDATE public.orders
    SET filled_qty = filled_qty + p_fill_qty,
        avg_fill_price = round((filled_qty * avg_fill_price + v_total_cost) / (filled_qty + p_fill_qty)),
        status = CASE WHEN (filled_qty + p_fill_qty) >= qty THEN 'FILLED'::public.order_status_v2 ELSE 'PARTIALLY_FILLED'::public.order_status_v2 END,
        last_sequence_number = p_sequence_number,
        updated_at = now()
    WHERE client_order_id = p_client_order_id;

  ELSIF p_event_type = 'CANCEL' THEN
    UPDATE public.orders
    SET status = 'CANCELLED', last_sequence_number = p_sequence_number, updated_at = now()
    WHERE client_order_id = p_client_order_id;

  ELSIF p_event_type = 'REJECT' THEN
    UPDATE public.orders
    SET status = 'REJECTED', last_sequence_number = p_sequence_number, updated_at = now()
    WHERE client_order_id = p_client_order_id;
  END IF;

  -- 7. Log event and audit transitions
  INSERT INTO public.broker_execution_events (
    execution_id, client_order_id, broker_order_id, event_type, sequence_number, filled_qty, execution_price, raw_payload
  ) VALUES (
    p_execution_id, p_client_order_id, COALESCE((SELECT broker_order_id FROM public.orders WHERE client_order_id = p_client_order_id), 'mock_id'),
    p_event_type, p_sequence_number, p_fill_qty, p_fill_price, p_raw_payload
  );

  INSERT INTO public.order_audit_trail (
    client_order_id, actor, action_type, old_status, new_status, change_details
  ) VALUES (
    p_client_order_id, 'SYSTEM', 'STATE_TRANSITION', v_current_status,
    (SELECT status FROM public.orders WHERE client_order_id = p_client_order_id),
    json_build_object('event_type', p_event_type, 'sequence_number', p_sequence_number, 'execution_id', p_execution_id)
  );

  RETURN json_build_object('success', true, 'client_order_id', p_client_order_id);
END;
$$;

-- Revoke public execute rights and grant strictly to service_role
REVOKE EXECUTE ON FUNCTION public.execute_trade_v2(varchar, varchar, varchar, numeric, numeric, bigint, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_trade_v2(varchar, varchar, varchar, numeric, numeric, bigint, jsonb) TO service_role;

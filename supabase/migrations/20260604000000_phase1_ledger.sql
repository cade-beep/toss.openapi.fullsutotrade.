-- 1. Rename Legacy Tables
ALTER TABLE public.portfolio RENAME TO portfolio_legacy;
ALTER TABLE public.positions RENAME TO positions_legacy;
ALTER TABLE public.orders_log RENAME TO orders_legacy;

-- Rename policies so they don't conflict, though they stay with the table
ALTER POLICY "Users can view their own portfolio" ON public.portfolio_legacy RENAME TO "Users can view their own portfolio_legacy";
ALTER POLICY "Users can insert their own portfolio" ON public.portfolio_legacy RENAME TO "Users can insert their own portfolio_legacy";
ALTER POLICY "Users can update their own portfolio" ON public.portfolio_legacy RENAME TO "Users can update their own portfolio_legacy";

ALTER POLICY "Users can view their own positions" ON public.positions_legacy RENAME TO "Users can view their own positions_legacy";
ALTER POLICY "Users can insert their own positions" ON public.positions_legacy RENAME TO "Users can insert their own positions_legacy";
ALTER POLICY "Users can update their own positions" ON public.positions_legacy RENAME TO "Users can update their own positions_legacy";
ALTER POLICY "Users can delete their own positions" ON public.positions_legacy RENAME TO "Users can delete their own positions_legacy";

ALTER POLICY "Users can view their own orders" ON public.orders_legacy RENAME TO "Users can view their own orders_legacy";
ALTER POLICY "Users can insert their own orders" ON public.orders_legacy RENAME TO "Users can insert their own orders_legacy";

-- 2. Create Ledger Tables
CREATE TABLE public.portfolio_ledger (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  amount bigint NOT NULL,
  reference_id varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.position_ledger (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  symbol varchar(10) NOT NULL,
  qty_change numeric(12, 4) NOT NULL,
  price numeric(16, 4) NOT NULL,
  reference_id varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for Ledgers
ALTER TABLE public.portfolio_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own portfolio ledger" ON public.portfolio_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own portfolio ledger" ON public.portfolio_ledger FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own position ledger" ON public.position_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own position ledger" ON public.position_ledger FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Create Broker Order Mapping Schema (Phase 1)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status_v2') THEN
    CREATE TYPE public.order_status_v2 AS ENUM (
      'PENDING', 
      'SUBMITTED', 
      'PARTIALLY_FILLED', 
      'FILLED', 
      'CANCELLING', 
      'CANCELLED', 
      'REJECTED'
    );
  END IF;
END
$$;

CREATE TABLE public.orders (
  client_order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_order_id varchar(100) UNIQUE,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  symbol varchar(10) NOT NULL,
  side varchar(10) NOT NULL CHECK (side IN ('BUY', 'SELL')),
  type varchar(10) NOT NULL CHECK (type IN ('MARKET', 'LIMIT')),
  qty numeric(12, 4) NOT NULL CHECK (qty > 0),
  price numeric(16, 4) CHECK (price >= 0),
  status public.order_status_v2 DEFAULT 'PENDING' NOT NULL,
  filled_qty numeric(12, 4) DEFAULT 0.0000 NOT NULL CHECK (filled_qty >= 0),
  avg_fill_price numeric(16, 4) DEFAULT 0.0000 NOT NULL CHECK (avg_fill_price >= 0),
  parent_client_order_id uuid REFERENCES public.orders(client_order_id) ON DELETE SET NULL,
  trading_mode varchar(20) NOT NULL CHECK (trading_mode IN ('SIMULATION', 'PAPER', 'LIVE')),
  last_sequence_number bigint DEFAULT 0 NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_user_id ON public.orders(user_id);

CREATE TABLE public.broker_execution_events (
  execution_id varchar(100) PRIMARY KEY,
  client_order_id uuid REFERENCES public.orders(client_order_id) ON DELETE CASCADE NOT NULL,
  broker_order_id varchar(100) NOT NULL,
  event_type varchar(20) NOT NULL CHECK (event_type IN ('ACK', 'PARTIAL_FILL', 'FULL_FILL', 'CANCEL', 'REPLACE', 'REJECT')),
  sequence_number bigint NOT NULL,
  filled_qty numeric(12, 4) NOT NULL CHECK (filled_qty >= 0),
  execution_price numeric(16, 4) NOT NULL CHECK (execution_price >= 0),
  raw_payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_order_id uuid REFERENCES public.orders(client_order_id) ON DELETE CASCADE NOT NULL,
  actor varchar(20) NOT NULL CHECK (actor IN ('SYSTEM', 'USER', 'AI_BOT')),
  action_type varchar(30) NOT NULL,
  old_status public.order_status_v2,
  new_status public.order_status_v2 NOT NULL,
  change_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own orders v2" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own orders v2" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own orders v2" ON public.orders FOR UPDATE USING (auth.uid() = user_id);

-- 4. Create Views for UI Compatibility
CREATE VIEW public.portfolio AS
SELECT user_id, 
       COALESCE(SUM(amount), 0)::bigint AS cash_balance, 
       MAX(created_at) AS updated_at
FROM public.portfolio_ledger
GROUP BY user_id;

CREATE VIEW public.positions AS
WITH position_summary AS (
  SELECT user_id, symbol,
         SUM(qty_change) AS qty,
         SUM(CASE WHEN qty_change > 0 THEN qty_change * price ELSE 0 END) AS total_buy_cost,
         SUM(CASE WHEN qty_change > 0 THEN qty_change ELSE 0 END) AS total_buy_qty,
         MAX(created_at) AS updated_at
  FROM public.position_ledger
  GROUP BY user_id, symbol
)
SELECT 
  md5(user_id::text || symbol)::uuid AS id,
  user_id, 
  symbol, 
  qty::integer, 
  CASE WHEN total_buy_qty > 0 THEN round(total_buy_cost / total_buy_qty)::integer ELSE 0 END AS avg_buy_price,
  updated_at
FROM position_summary
WHERE qty > 0;

CREATE VIEW public.orders_log AS
SELECT 
  client_order_id::varchar(50) AS id, 
  user_id, 
  symbol, 
  side::varchar(10), 
  type::varchar(10), 
  qty::integer, 
  price::integer, 
  status::varchar(20), 
  created_at
FROM public.orders;

-- 5. Create INSTEAD OF Triggers to support legacy inserts from the UI
CREATE OR REPLACE FUNCTION public.portfolio_insert_handler() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.portfolio_ledger (user_id, amount, reference_id)
  VALUES (NEW.user_id, NEW.cash_balance, 'INITIALIZATION');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER portfolio_view_insert
INSTEAD OF INSERT ON public.portfolio
FOR EACH ROW EXECUTE FUNCTION public.portfolio_insert_handler();

-- 6. Re-implement execute_trade to append to ledgers (Preserves UI execution)
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
  v_current_qty numeric;
  v_client_order_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authentication required.';
  END IF;

  v_total_cost := p_qty::bigint * p_price::bigint;

  -- Verify balance via view
  SELECT cash_balance INTO v_cash_balance FROM public.portfolio WHERE user_id = v_user_id;
  IF v_cash_balance IS NULL THEN
    v_cash_balance := 0;
  END IF;

  -- Verify positions via view
  SELECT qty INTO v_current_qty FROM public.positions WHERE user_id = v_user_id AND symbol = p_symbol;
  IF v_current_qty IS NULL THEN
    v_current_qty := 0;
  END IF;

  IF p_side = 'BUY' THEN
    IF v_cash_balance < v_total_cost THEN
      RAISE EXCEPTION 'Insufficient balance: cash balance is %, purchase cost is %.', v_cash_balance, v_total_cost;
    END IF;

    -- Append to ledgers
    INSERT INTO public.portfolio_ledger (user_id, amount, reference_id)
    VALUES (v_user_id, -v_total_cost, p_order_id);

    INSERT INTO public.position_ledger (user_id, symbol, qty_change, price, reference_id)
    VALUES (v_user_id, p_symbol, p_qty, p_price, p_order_id);

  ELSIF p_side = 'SELL' THEN
    IF v_current_qty < p_qty THEN
      RAISE EXCEPTION 'Insufficient shares: owned %, requested sale quantity is %.', v_current_qty, p_qty;
    END IF;

    -- Append to ledgers
    INSERT INTO public.portfolio_ledger (user_id, amount, reference_id)
    VALUES (v_user_id, v_total_cost, p_order_id);

    INSERT INTO public.position_ledger (user_id, symbol, qty_change, price, reference_id)
    VALUES (v_user_id, p_symbol, -p_qty, p_price, p_order_id);
  ELSE
    RAISE EXCEPTION 'Invalid trade side specification.';
  END IF;

  -- Create tracking order in v2 table
  INSERT INTO public.orders (
    user_id, symbol, side, type, qty, price, status, filled_qty, avg_fill_price, trading_mode
  ) VALUES (
    v_user_id, p_symbol, p_side, 'MARKET', p_qty, p_price, 'FILLED', p_qty, p_price, 'SIMULATION'
  ) RETURNING client_order_id INTO v_client_order_id;

  RETURN json_build_object(
    'success', true,
    'order_id', p_order_id,
    'client_order_id', v_client_order_id,
    'side', p_side,
    'qty', p_qty,
    'price', p_price
  );
END;
$$;

-- 7. Create execute_trade_v2 for Future Queues
-- (Simplified version from the architecture document focusing on append-only)
CREATE OR REPLACE FUNCTION public.execute_trade_v2(
  p_execution_id varchar(100),
  p_client_order_id uuid,
  p_fill_qty numeric(12, 4),
  p_fill_price numeric(16, 4),
  p_sequence_number bigint,
  p_raw_payload jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_symbol varchar(10);
  v_side varchar(10);
  v_current_status public.order_status_v2;
  v_total_cost bigint;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authentication required.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.broker_execution_events WHERE execution_id = p_execution_id) THEN
    RETURN json_build_object('success', true, 'message', 'Execution already processed.', 'execution_id', p_execution_id);
  END IF;

  SELECT symbol, side, status 
  INTO v_symbol, v_side, v_current_status
  FROM public.orders WHERE client_order_id = p_client_order_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  v_total_cost := (p_fill_qty * p_fill_price)::bigint;

  -- Append to ledgers based on Side
  IF v_side = 'BUY' THEN
    INSERT INTO public.portfolio_ledger (user_id, amount, reference_id) VALUES (v_user_id, -v_total_cost, p_execution_id);
    INSERT INTO public.position_ledger (user_id, symbol, qty_change, price, reference_id) VALUES (v_user_id, v_symbol, p_fill_qty, p_fill_price, p_execution_id);
  ELSIF v_side = 'SELL' THEN
    INSERT INTO public.portfolio_ledger (user_id, amount, reference_id) VALUES (v_user_id, v_total_cost, p_execution_id);
    INSERT INTO public.position_ledger (user_id, symbol, qty_change, price, reference_id) VALUES (v_user_id, v_symbol, -p_fill_qty, p_fill_price, p_execution_id);
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

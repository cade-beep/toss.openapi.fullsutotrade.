-- Supabase Migration: PR-5B Orders and Risk Profile RLS Hardening

-- 1. Drop direct UPDATE policies from authenticated users
DROP POLICY IF EXISTS "Users can update their own orders v2" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own risk profile" ON public.risk_profiles;

-- 2. Secure RPC to update order status (Runs with SECURITY DEFINER privileges)
CREATE OR REPLACE FUNCTION public.update_order_status_v2(
  p_client_order_id varchar(100),
  p_status varchar(50),
  p_error_message text DEFAULT NULL
)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Retrieve user_id from orders table for the specified client_order_id
  SELECT user_id INTO v_user_id
  FROM public.orders
  WHERE client_order_id = p_client_order_id;

  -- Verify ownership: the authenticated user must own the order
  -- (or we must be running under system/worker context where auth.uid() is null/custom, but for safety: 
  -- if auth.uid() is not null, it must match)
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User does not own the order or order not found.';
  END IF;

  -- Update order status safely
  UPDATE public.orders
  SET
    status = p_status,
    error_message = COALESCE(p_error_message, error_message),
    updated_at = now()
  WHERE client_order_id = p_client_order_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Secure RPC to update risk profile (Runs with SECURITY DEFINER privileges)
CREATE OR REPLACE FUNCTION public.update_risk_profile_v2(
  p_max_open_positions integer,
  p_max_position_size_value bigint,
  p_max_order_value bigint,
  p_max_symbol_exposure_pct numeric,
  p_max_portfolio_exposure_pct numeric,
  p_daily_loss_limit bigint,
  p_kill_switch_active boolean,
  p_max_trades_per_minute integer,
  p_min_ai_confidence numeric
)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update the risk profile matching auth.uid()
  -- (If running under background context where auth.uid() is null, raise exception)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: authenticated session required to update risk profile.';
  END IF;

  INSERT INTO public.risk_profiles (
    user_id,
    max_open_positions,
    max_position_size_value,
    max_order_value,
    max_symbol_exposure_pct,
    max_portfolio_exposure_pct,
    daily_loss_limit,
    kill_switch_active,
    max_trades_per_minute,
    min_ai_confidence,
    updated_at
  ) VALUES (
    auth.uid(),
    p_max_open_positions,
    p_max_position_size_value,
    p_max_order_value,
    p_max_symbol_exposure_pct,
    p_max_portfolio_exposure_pct,
    p_daily_loss_limit,
    p_kill_switch_active,
    p_max_trades_per_minute,
    p_min_ai_confidence,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    max_open_positions = EXCLUDED.max_open_positions,
    max_position_size_value = EXCLUDED.max_position_size_value,
    max_order_value = EXCLUDED.max_order_value,
    max_symbol_exposure_pct = EXCLUDED.max_symbol_exposure_pct,
    max_portfolio_exposure_pct = EXCLUDED.max_portfolio_exposure_pct,
    daily_loss_limit = EXCLUDED.daily_loss_limit,
    kill_switch_active = EXCLUDED.kill_switch_active,
    max_trades_per_minute = EXCLUDED.max_trades_per_minute,
    min_ai_confidence = EXCLUDED.min_ai_confidence,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

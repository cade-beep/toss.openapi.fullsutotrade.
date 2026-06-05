-- Supabase Rollback Migration: PR-5B Orders and Risk Profile RLS Hardening

-- 1. Restore original direct UPDATE policies
CREATE POLICY "Users can update their own orders v2" ON public.orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own risk profile" ON public.risk_profiles FOR UPDATE USING (auth.uid() = user_id);

-- 2. Drop secure functions
DROP FUNCTION IF EXISTS public.update_order_status_v2(varchar, varchar, text);
DROP FUNCTION IF EXISTS public.update_risk_profile_v2(integer, bigint, bigint, numeric, numeric, bigint, boolean, integer, numeric);

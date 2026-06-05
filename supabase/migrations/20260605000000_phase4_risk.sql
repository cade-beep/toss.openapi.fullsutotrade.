-- Create risk profiles table
CREATE TABLE IF NOT EXISTS public.risk_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  max_open_positions integer NOT NULL DEFAULT 5 CHECK (max_open_positions > 0),
  max_position_size_value bigint NOT NULL DEFAULT 10000000 CHECK (max_position_size_value > 0),
  max_order_value bigint NOT NULL DEFAULT 5000000 CHECK (max_order_value > 0),
  max_symbol_exposure_pct numeric(5, 2) NOT NULL DEFAULT 30.00 CHECK (max_symbol_exposure_pct > 0 AND max_symbol_exposure_pct <= 100.00),
  max_portfolio_exposure_pct numeric(5, 2) NOT NULL DEFAULT 100.00 CHECK (max_portfolio_exposure_pct > 0),
  daily_loss_limit bigint NOT NULL DEFAULT 1000000 CHECK (daily_loss_limit >= 0),
  kill_switch_active boolean NOT NULL DEFAULT false,
  max_trades_per_minute integer NOT NULL DEFAULT 10 CHECK (max_trades_per_minute > 0),
  min_ai_confidence numeric(3, 2) NOT NULL DEFAULT 0.70 CHECK (min_ai_confidence >= 0.00 AND min_ai_confidence <= 1.00),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for risk_profiles
ALTER TABLE public.risk_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for risk_profiles
CREATE POLICY "Users can view their own risk profile" 
  ON public.risk_profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own risk profile" 
  ON public.risk_profiles FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own risk profile" 
  ON public.risk_profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create daily snapshots table to calculate daily loss
CREATE TABLE IF NOT EXISTS public.daily_portfolio_snapshots (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  snapshot_date date NOT NULL,
  start_of_day_portfolio_value bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, snapshot_date)
);

-- Enable RLS for snapshots
ALTER TABLE public.daily_portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies for snapshots
CREATE POLICY "Users can view their own daily snapshots" 
  ON public.daily_portfolio_snapshots FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily snapshots" 
  ON public.daily_portfolio_snapshots FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Automated trigger to create default risk profile upon user creation (locked down search_path)
CREATE OR REPLACE FUNCTION public.handle_new_user_risk_profile()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.risk_profiles (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created_risk
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_risk_profile();

-- Database consistency adjustments
ALTER TABLE public.portfolio_state DROP CONSTRAINT IF EXISTS chk_cash_balance_positive;
ALTER TABLE public.portfolio_state ADD CONSTRAINT chk_cash_balance_positive CHECK (cash_balance >= 0);

-- Composite Index for frequency check optimization
CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at ON public.orders(user_id, created_at DESC);

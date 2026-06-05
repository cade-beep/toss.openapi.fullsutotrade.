-- Create user strategies table
CREATE TABLE IF NOT EXISTS public.user_strategies (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  strategy_id varchar(50) NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  allocation_pct integer NOT NULL DEFAULT 0 CHECK (allocation_pct >= 0 AND allocation_pct <= 100),
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, strategy_id)
);

-- Enable RLS
ALTER TABLE public.user_strategies ENABLE ROW LEVEL SECURITY;

-- Policies for user_strategies
CREATE POLICY "Users can view their own user strategies" 
  ON public.user_strategies FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own user strategies" 
  ON public.user_strategies FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own user strategies" 
  ON public.user_strategies FOR UPDATE 
  USING (auth.uid() = user_id);

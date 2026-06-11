-- Create historical_candles table for backtesting historical data
CREATE TABLE IF NOT EXISTS public.historical_candles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol varchar(10) NOT NULL,
  candle_date date NOT NULL,
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  volume bigint NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(symbol, candle_date)
);

-- Enable RLS
ALTER TABLE public.historical_candles ENABLE ROW LEVEL SECURITY;

-- Allow read access to historical candles for all users
CREATE POLICY "Allow select access to historical candles for everyone" 
ON public.historical_candles 
FOR SELECT 
USING (true);

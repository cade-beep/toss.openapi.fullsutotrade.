-- Add account_id to public.api_credentials table
ALTER TABLE public.api_credentials 
ADD COLUMN IF NOT EXISTS account_id text;

-- Remove account_id from public.api_credentials table
ALTER TABLE public.api_credentials 
DROP COLUMN IF EXISTS account_id;

-- Add encrypted_webhook_secret to public.api_credentials
ALTER TABLE public.api_credentials 
ADD COLUMN IF NOT EXISTS encrypted_webhook_secret text;

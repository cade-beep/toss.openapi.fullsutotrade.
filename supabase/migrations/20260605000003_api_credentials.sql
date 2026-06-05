-- Create api_credentials table
CREATE TABLE IF NOT EXISTS public.api_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  encrypted_api_key text NOT NULL,
  encrypted_secret_key text NOT NULL,
  encrypted_webhook_secret text,
  is_simulation boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;

-- Select/Insert/Update/Delete policies
CREATE POLICY "Users can manage their own api credentials" 
  ON public.api_credentials 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_credentials TO service_role;

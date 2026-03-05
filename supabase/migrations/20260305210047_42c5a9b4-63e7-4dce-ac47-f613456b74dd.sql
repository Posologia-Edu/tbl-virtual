
ALTER TABLE public.ai_usage_log
  ADD COLUMN IF NOT EXISTS model text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prompt_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tokens_input integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_output integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd numeric DEFAULT 0;

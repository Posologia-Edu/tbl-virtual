
-- Table: ai_usage_log
CREATE TABLE public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  provider TEXT,
  tokens_used INTEGER DEFAULT 0
);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai usage"
  ON public.ai_usage_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert ai usage"
  ON public.ai_usage_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Table: manual_subscriptions
CREATE TABLE public.manual_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.manual_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage manual subscriptions"
  ON public.manual_subscriptions FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users view own subscription"
  ON public.manual_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

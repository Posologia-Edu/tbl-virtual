
DROP POLICY "Service role can insert ai usage" ON public.ai_usage_log;

CREATE POLICY "Users can insert own ai usage"
  ON public.ai_usage_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

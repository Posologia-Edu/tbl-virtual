-- Allow institutional plan owners to manage subscriptions they granted
CREATE POLICY "Users can select subscriptions they granted"
ON public.manual_subscriptions
FOR SELECT
USING (granted_by = auth.uid());

CREATE POLICY "Users can insert subscriptions they grant"
ON public.manual_subscriptions
FOR INSERT
WITH CHECK (granted_by = auth.uid());

CREATE POLICY "Users can update subscriptions they granted"
ON public.manual_subscriptions
FOR UPDATE
USING (granted_by = auth.uid());

CREATE POLICY "Users can delete subscriptions they granted"
ON public.manual_subscriptions
FOR DELETE
USING (granted_by = auth.uid());

CREATE TABLE public.system_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'feature',
  status text NOT NULL DEFAULT 'done',
  priority text DEFAULT 'medium',
  version text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  implemented_at timestamp with time zone,
  created_by uuid,
  tags text[] DEFAULT '{}',
  notes text
);

ALTER TABLE public.system_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view done updates" ON public.system_updates
  FOR SELECT TO authenticated
  USING (status = 'done');

CREATE POLICY "Admins can manage all updates" ON public.system_updates
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

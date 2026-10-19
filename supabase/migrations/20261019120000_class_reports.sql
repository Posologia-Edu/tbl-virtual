-- Boletim consolidado salvo por turma. Um registro por turma; regenerar sobrescreve.
CREATE TABLE public.class_reports (
  class_id uuid NOT NULL PRIMARY KEY REFERENCES public.classes(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.class_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own class reports" ON public.class_reports FOR ALL
USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = class_reports.class_id AND classes.teacher_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = class_reports.class_id AND classes.teacher_id = auth.uid()));

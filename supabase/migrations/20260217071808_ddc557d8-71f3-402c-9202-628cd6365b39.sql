
-- Create classes/disciplines table
CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  semester text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own classes" ON public.classes FOR ALL USING (teacher_id = auth.uid());

-- Add class_id to rooms
ALTER TABLE public.rooms ADD COLUMN class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL;

-- Create class_students table for enrolled students
CREATE TABLE public.class_students (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id)
);

ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage class students" ON public.class_students FOR ALL
USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = class_students.class_id AND classes.teacher_id = auth.uid()));

CREATE POLICY "Students view own enrollment" ON public.class_students FOR SELECT
USING (student_id = auth.uid());

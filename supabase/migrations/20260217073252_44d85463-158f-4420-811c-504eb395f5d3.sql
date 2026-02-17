
-- Add categorization and sharing fields to quizzes
ALTER TABLE public.quizzes
ADD COLUMN discipline text,
ADD COLUMN theme text,
ADD COLUMN difficulty_level text DEFAULT 'medium',
ADD COLUMN is_shared boolean NOT NULL DEFAULT false;

-- Allow teachers to view shared quizzes from other teachers
CREATE POLICY "Teachers can view shared quizzes"
ON public.quizzes
FOR SELECT
USING (is_shared = true AND has_role(auth.uid(), 'teacher'));

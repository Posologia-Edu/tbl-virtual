
-- Add quiz_id to application_questions so they can be managed at quiz level
ALTER TABLE public.application_questions ADD COLUMN quiz_id uuid REFERENCES public.quizzes(id) ON DELETE CASCADE;

-- Make room_id nullable (questions created at quiz level won't have a room yet)
ALTER TABLE public.application_questions ALTER COLUMN room_id DROP NOT NULL;

-- Add RLS policy for teachers to manage via quiz
CREATE POLICY "Teachers manage app questions via quiz"
ON public.application_questions
FOR ALL
USING (EXISTS (
  SELECT 1 FROM quizzes WHERE quizzes.id = application_questions.quiz_id AND quizzes.teacher_id = auth.uid()
));

-- Index for performance
CREATE INDEX idx_application_questions_quiz_id ON public.application_questions(quiz_id);


-- Drop the existing restrictive policies
DROP POLICY IF EXISTS "Students can view questions in active rooms" ON public.questions;
DROP POLICY IF EXISTS "Teachers manage questions" ON public.questions;

-- Recreate as PERMISSIVE policies (default) so either one can grant access
CREATE POLICY "Students can view questions in active rooms"
ON public.questions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM quizzes q
    JOIN rooms r ON r.quiz_id = q.id
    JOIN room_participants rp ON rp.room_id = r.id
    WHERE q.id = questions.quiz_id
    AND rp.user_id = auth.uid()
    AND r.current_stage <> 'waiting'::room_stage
  )
);

CREATE POLICY "Teachers manage questions"
ON public.questions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM quizzes
    WHERE quizzes.id = questions.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

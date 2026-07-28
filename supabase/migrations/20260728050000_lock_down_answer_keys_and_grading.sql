-- Fix two related vulnerabilities affecting iRAT/tRAT/Application grading integrity:
--
-- 1. "Students can view questions in active rooms" / "Students view app questions" let
--    any room participant SELECT the full row directly (correct_option/correct_answer/
--    explanation included) as soon as the room leaves 'waiting'. The app UI only hides
--    these fields until the appropriate feedback stage, but the underlying data was
--    always present in the API response — a student opening devtools (or just calling
--    supabase-js from the console) could read the answer key ahead of time.
--
-- 2. src/pages/StudentRoomView.tsx computes score/is_correct client-side and inserts it
--    directly into irat_responses/trat_attempts. RLS only checks student_id/team
--    ownership, never that the score is truthful — any student can POST a forged
--    perfect score without even knowing the right answer.
--
-- Fix: drop student direct-table SELECT access to the answer-bearing tables and
-- replace it with SECURITY DEFINER RPCs that (a) mask correct_option/correct_answer/
-- explanation until the appropriate stage, and (b) compute score/is_correct server-side
-- from the real answer key, ignoring any client-supplied grade.

DROP POLICY IF EXISTS "Students can view questions in active rooms" ON public.questions;
DROP POLICY IF EXISTS "Students view app questions" ON public.application_questions;

-- Masked question feed for students: hides correct_option/explanation until the
-- question has been individually answered (iRAT reveal) or the room has moved past
-- tRAT (trat_feedback and later stages).
CREATE OR REPLACE FUNCTION public.get_room_quiz_questions(p_room_id uuid)
RETURNS TABLE (
  id uuid,
  quiz_id uuid,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  sort_order integer,
  media jsonb,
  correct_option char(1),
  explanation text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz_id uuid;
  v_stage room_stage;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.room_participants rp WHERE rp.room_id = p_room_id AND rp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this room';
  END IF;

  SELECT r.quiz_id, r.current_stage INTO v_quiz_id, v_stage FROM public.rooms r WHERE r.id = p_room_id;

  IF v_quiz_id IS NULL OR v_stage = 'waiting' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    q.id, q.quiz_id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
    q.sort_order, q.media,
    CASE WHEN v_stage IN ('trat_feedback','appeals_open','application_open','application_feedback','finished')
           OR EXISTS (
             SELECT 1 FROM public.irat_responses ir
             WHERE ir.question_id = q.id AND ir.room_id = p_room_id AND ir.student_id = auth.uid()
           )
         THEN q.correct_option ELSE NULL END,
    CASE WHEN v_stage IN ('trat_feedback','appeals_open','application_open','application_feedback','finished')
           OR EXISTS (
             SELECT 1 FROM public.irat_responses ir
             WHERE ir.question_id = q.id AND ir.room_id = p_room_id AND ir.student_id = auth.uid()
           )
         THEN q.explanation ELSE NULL END
  FROM public.questions q
  WHERE q.quiz_id = v_quiz_id AND q.deleted_at IS NULL
  ORDER BY q.sort_order;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_room_quiz_questions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_room_quiz_questions(uuid) TO authenticated;

-- Masked application-question feed: correct_answer/explanation only visible once the
-- room has reached the application feedback walkthrough (or is finished).
CREATE OR REPLACE FUNCTION public.get_room_application_questions(p_room_id uuid)
RETURNS TABLE (
  id uuid,
  room_id uuid,
  quiz_id uuid,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  sort_order integer,
  media jsonb,
  correct_answer char(1),
  explanation text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage room_stage;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.room_participants rp WHERE rp.room_id = p_room_id AND rp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this room';
  END IF;

  SELECT r.current_stage INTO v_stage FROM public.rooms r WHERE r.id = p_room_id;

  RETURN QUERY
  SELECT
    aq.id, aq.room_id, aq.quiz_id, aq.question_text, aq.option_a, aq.option_b, aq.option_c, aq.option_d,
    aq.sort_order, aq.media,
    CASE WHEN v_stage IN ('application_feedback','finished') THEN aq.correct_answer ELSE NULL END,
    CASE WHEN v_stage IN ('application_feedback','finished') THEN aq.explanation ELSE NULL END
  FROM public.application_questions aq
  WHERE aq.room_id = p_room_id AND aq.deleted_at IS NULL
  ORDER BY aq.sort_order;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_room_application_questions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_room_application_questions(uuid) TO authenticated;

-- Server-side iRAT grading: score is derived from the real correct_option, never
-- trusted from the client. Mirrors the point-distribution (IF-AT) scoring already
-- used by the app, just computed here instead of in the browser.
CREATE OR REPLACE FUNCTION public.submit_irat_response(
  p_question_id uuid,
  p_room_id uuid,
  p_points_a integer,
  p_points_b integer,
  p_points_c integer,
  p_points_d integer
)
RETURNS public.irat_responses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correct_option char(1);
  v_score integer;
  v_result public.irat_responses;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_points_a IS NULL OR p_points_b IS NULL OR p_points_c IS NULL OR p_points_d IS NULL
     OR p_points_a < 0 OR p_points_b < 0 OR p_points_c < 0 OR p_points_d < 0
     OR (p_points_a + p_points_b + p_points_c + p_points_d) <> 4 THEN
    RAISE EXCEPTION 'Points must be non-negative and sum to 4';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.rooms r ON r.id = tm.room_id
    JOIN public.questions q ON q.quiz_id = r.quiz_id
    WHERE tm.room_id = p_room_id AND tm.user_id = auth.uid() AND q.id = p_question_id
  ) THEN
    RAISE EXCEPTION 'Not authorized for this question';
  END IF;

  SELECT correct_option INTO v_correct_option FROM public.questions WHERE id = p_question_id;

  v_score := CASE v_correct_option
    WHEN 'A' THEN p_points_a
    WHEN 'B' THEN p_points_b
    WHEN 'C' THEN p_points_c
    WHEN 'D' THEN p_points_d
    ELSE 0
  END;

  INSERT INTO public.irat_responses
    (student_id, question_id, room_id, points_a, points_b, points_c, points_d, score, is_correct)
  VALUES
    (auth.uid(), p_question_id, p_room_id, p_points_a, p_points_b, p_points_c, p_points_d, v_score, v_score > 0)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_irat_response(uuid, uuid, integer, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_irat_response(uuid, uuid, integer, integer, integer, integer) TO authenticated;

-- Server-side tRAT grading: attempt number and correctness are derived server-side;
-- the client only supplies which option the team picked.
CREATE OR REPLACE FUNCTION public.submit_trat_attempt(
  p_question_id uuid,
  p_room_id uuid,
  p_selected_option text
)
RETURNS public.trat_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
  v_correct_option char(1);
  v_attempt_number integer;
  v_is_correct boolean;
  v_result public.trat_attempts;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_selected_option NOT IN ('A','B','C','D') THEN
    RAISE EXCEPTION 'Invalid option';
  END IF;

  SELECT tm.team_id INTO v_team_id
  FROM public.team_members tm
  WHERE tm.room_id = p_room_id AND tm.user_id = auth.uid();

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.questions q
    JOIN public.rooms r ON r.quiz_id = q.quiz_id
    WHERE r.id = p_room_id AND q.id = p_question_id
  ) THEN
    RAISE EXCEPTION 'Question does not belong to this room';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trat_attempts
    WHERE team_id = v_team_id AND question_id = p_question_id AND room_id = p_room_id AND is_correct = true
  ) THEN
    RAISE EXCEPTION 'Question already answered correctly';
  END IF;

  SELECT COUNT(*) + 1 INTO v_attempt_number
  FROM public.trat_attempts
  WHERE team_id = v_team_id AND question_id = p_question_id AND room_id = p_room_id;

  IF v_attempt_number > 4 THEN
    RAISE EXCEPTION 'No attempts left';
  END IF;

  SELECT correct_option INTO v_correct_option FROM public.questions WHERE id = p_question_id;
  v_is_correct := (p_selected_option = v_correct_option);

  INSERT INTO public.trat_attempts
    (team_id, question_id, room_id, attempt_number, selected_option, is_correct, submitted_by)
  VALUES
    (v_team_id, p_question_id, p_room_id, v_attempt_number, p_selected_option, v_is_correct, auth.uid())
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_trat_attempt(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_trat_attempt(uuid, uuid, text) TO authenticated;

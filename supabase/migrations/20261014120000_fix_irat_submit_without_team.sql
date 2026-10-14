-- submit_irat_response (20260728050000) required the student to be in team_members,
-- but the iRAT is individual and happens before/independently of team formation
-- (StudentRoomView renders the iRAT without a membership). Students not yet in a team
-- got a 400 "Not authorized for this question". Authorize via room_participants instead,
-- the same check get_room_quiz_questions uses.
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
    SELECT 1 FROM public.room_participants rp
    JOIN public.rooms r ON r.id = rp.room_id
    JOIN public.questions q ON q.quiz_id = r.quiz_id
    WHERE rp.room_id = p_room_id AND rp.user_id = auth.uid() AND q.id = p_question_id
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

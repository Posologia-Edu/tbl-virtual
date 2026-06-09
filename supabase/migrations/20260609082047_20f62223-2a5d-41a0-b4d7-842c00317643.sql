
-- 1. Fix teams: restrict SELECT to authenticated room participants or teacher
DROP POLICY IF EXISTS "Anyone in room can view teams" ON public.teams;
CREATE POLICY "Room participants and teacher can view teams"
ON public.teams
FOR SELECT
TO authenticated
USING (
  public.is_room_participant(room_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = teams.room_id AND r.teacher_id = auth.uid())
);

-- 2. Fix student_achievements: remove direct INSERT, gate via SECURITY DEFINER function
DROP POLICY IF EXISTS "Students can insert own achievements" ON public.student_achievements;

CREATE OR REPLACE FUNCTION public.grant_student_achievement(
  _achievement_key text,
  _achievement_name text,
  _achievement_description text,
  _icon text,
  _room_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _new_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Caller must be a participant of the room
  IF NOT public.is_room_participant(_room_id, _user_id) THEN
    RAISE EXCEPTION 'User is not a participant of this room';
  END IF;

  -- Validate inputs (basic length + non-empty)
  IF _achievement_key IS NULL OR length(_achievement_key) = 0 OR length(_achievement_key) > 100 THEN
    RAISE EXCEPTION 'Invalid achievement_key';
  END IF;
  IF _achievement_name IS NULL OR length(_achievement_name) > 200 THEN
    RAISE EXCEPTION 'Invalid achievement_name';
  END IF;

  -- Prevent duplicates per user/room/key
  IF EXISTS (
    SELECT 1 FROM public.student_achievements
    WHERE user_id = _user_id AND room_id = _room_id AND achievement_key = _achievement_key
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.student_achievements (
    user_id, achievement_key, achievement_name, achievement_description, icon, room_id
  ) VALUES (
    _user_id, _achievement_key, _achievement_name, _achievement_description, _icon, _room_id
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_student_achievement(text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_student_achievement(text, text, text, text, uuid) TO authenticated;

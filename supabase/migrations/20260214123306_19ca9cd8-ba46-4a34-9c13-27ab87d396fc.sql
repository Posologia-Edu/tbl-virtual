
-- 1. Add irat_end_time to rooms for timer functionality
ALTER TABLE public.rooms ADD COLUMN irat_end_time timestamptz;

-- 2. Create room_participants table (students join room independently of teams)
CREATE TABLE public.room_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  participant_code char(4) NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, room_id),
  UNIQUE(room_id, participant_code)
);

ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view room participants" ON public.room_participants FOR SELECT USING (true);
CREATE POLICY "Students can join rooms" ON public.room_participants FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Students can leave rooms" ON public.room_participants FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Teachers can view participants" ON public.room_participants FOR SELECT USING (
  EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_participants.room_id AND rooms.teacher_id = auth.uid())
);

-- 3. Function to generate unique 4-digit participant code within a room
CREATE OR REPLACE FUNCTION public.generate_participant_code(p_room_id uuid)
RETURNS char
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  chars TEXT := '0123456789';
  result TEXT := '';
  i INT;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..4 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM room_participants WHERE room_id = p_room_id AND participant_code = result);
  END LOOP;
  RETURN result;
END;
$$;

-- 4. Security definer function to check team membership (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id)
$$;

-- 5. Security definer function to check room participation
CREATE OR REPLACE FUNCTION public.is_room_participant(p_room_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM room_participants WHERE room_id = p_room_id AND user_id = p_user_id)
$$;

-- 6. Update team_members INSERT policy to allow adding other students
DROP POLICY IF EXISTS "Students can join teams" ON public.team_members;
CREATE POLICY "Students can join teams" ON public.team_members
FOR INSERT WITH CHECK (
  user_id = auth.uid() OR public.is_team_member(team_id, auth.uid())
);

-- 7. Allow students to create teams during tRAT
CREATE POLICY "Students can create teams in their rooms" ON public.teams
FOR INSERT WITH CHECK (
  public.is_room_participant(room_id, auth.uid())
);

-- 8. Add unique constraint on team_members to prevent duplicate membership per room
ALTER TABLE public.team_members ADD CONSTRAINT unique_team_member_per_room UNIQUE (user_id, room_id);


-- 1) Fix profiles teacher overexposure: remove the unconditional teacher-role clause
DROP POLICY IF EXISTS "Authenticated users can view related profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view related profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.room_participants rp
    JOIN public.rooms r ON r.id = rp.room_id
    WHERE rp.user_id = profiles.id AND r.teacher_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.rooms r
    JOIN public.room_participants rp ON rp.room_id = r.id
    WHERE r.teacher_id = profiles.id AND rp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.room_participants rp1
    JOIN public.room_participants rp2 ON rp1.room_id = rp2.room_id
    WHERE rp1.user_id = auth.uid() AND rp2.user_id = profiles.id
  )
  OR EXISTS (
    SELECT 1 FROM public.class_students cs
    JOIN public.classes c ON c.id = cs.class_id
    WHERE cs.student_id = profiles.id AND c.teacher_id = auth.uid()
  )
);

-- 2) Restrict room_participants visibility
DROP POLICY IF EXISTS "Anyone can view room participants" ON public.room_participants;

CREATE POLICY "Participants and teacher can view room participants"
ON public.room_participants
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_room_participant(room_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = room_participants.room_id AND r.teacher_id = auth.uid()
  )
);

-- 3) Restrict team_members visibility
DROP POLICY IF EXISTS "Anyone can view team members" ON public.team_members;

CREATE POLICY "Room participants and teacher can view team members"
ON public.team_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_room_participant(room_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = team_members.room_id AND r.teacher_id = auth.uid()
  )
);

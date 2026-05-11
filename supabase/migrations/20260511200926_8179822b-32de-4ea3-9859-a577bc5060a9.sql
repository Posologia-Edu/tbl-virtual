
-- 1. Fix privilege escalation on user_roles: restrict self-insert to 'student' role only.
-- The handle_new_user trigger is SECURITY DEFINER and bypasses RLS, so teacher/admin
-- assignment via the signup metadata path keeps working.
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
CREATE POLICY "Users can insert own student role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND role = 'student'::app_role);

-- 2. Lock down manual_subscriptions: only admins may write. Users can still view their own row.
DROP POLICY IF EXISTS "Users can insert subscriptions they grant" ON public.manual_subscriptions;
DROP POLICY IF EXISTS "Users can update subscriptions they granted" ON public.manual_subscriptions;
DROP POLICY IF EXISTS "Users can delete subscriptions they granted" ON public.manual_subscriptions;
DROP POLICY IF EXISTS "Users can select subscriptions they granted" ON public.manual_subscriptions;

-- 3. Restrict profiles: remove public read of sensitive PII (CPF, email, address).
-- Drop the "Anyone can view profiles" policy and add scoped policies.
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- Users can view their own full profile.
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Authenticated users can view profiles of other users they share context with
-- (room participants, team members, teachers of rooms they joined, students of teachers' rooms, classes).
-- This still exposes columns broadly to authenticated users; column-level grants below
-- restrict access to truly sensitive fields.
CREATE POLICY "Authenticated users can view related profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Teachers can see profiles of students in their rooms
  EXISTS (
    SELECT 1 FROM public.room_participants rp
    JOIN public.rooms r ON r.id = rp.room_id
    WHERE rp.user_id = profiles.id AND r.teacher_id = auth.uid()
  )
  -- Students can see their teacher's profile
  OR EXISTS (
    SELECT 1 FROM public.rooms r
    JOIN public.room_participants rp ON rp.room_id = r.id
    WHERE r.teacher_id = profiles.id AND rp.user_id = auth.uid()
  )
  -- Members of same room can see each other
  OR EXISTS (
    SELECT 1 FROM public.room_participants rp1
    JOIN public.room_participants rp2 ON rp1.room_id = rp2.room_id
    WHERE rp1.user_id = auth.uid() AND rp2.user_id = profiles.id
  )
  -- Teachers can see profiles of students in their classes
  OR EXISTS (
    SELECT 1 FROM public.class_students cs
    JOIN public.classes c ON c.id = cs.class_id
    WHERE cs.student_id = profiles.id AND c.teacher_id = auth.uid()
  )
  -- Institutional teacher linking lookup (teacher invites by email)
  OR has_role(auth.uid(), 'teacher'::app_role)
);

-- Revoke column-level access to highly sensitive fields from anon/authenticated.
-- Admins access via is_admin() RLS but they too go through these grants; so we
-- grant only the safe columns broadly and rely on application admin code paths
-- using the service role (edge functions) for sensitive PII access if needed.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name, email, is_approved, is_blocked, institution, created_at, nickname)
  ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
-- Owner sees everything via a separate column grant set for own-row scenarios is
-- not possible at column-level. To allow users to read their own CPF/address,
-- we restore full column read for own profile via a SECURITY DEFINER function.
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;

-- Admin full-profile read via SECURITY DEFINER helper
CREATE OR REPLACE FUNCTION public.admin_get_profile(_user_id uuid)
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles
  WHERE id = _user_id AND public.is_admin(auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_profile(uuid) TO authenticated;

-- Fix critical privilege escalation: handle_new_user() is SECURITY DEFINER and
-- bypasses RLS, and previously trusted the client-supplied raw_user_meta_data->>'role'
-- verbatim (including 'admin'). Any caller could POST to the public signup endpoint
-- with { data: { role: 'admin' } } and become an administrator instantly.
--
-- The only legitimate app flows self-register as 'teacher' (src/pages/AuthPage.tsx)
-- or 'student' (src/pages/JoinRoomPage.tsx). 'admin' must never be grantable through
-- public signup metadata; it can only be assigned by an existing admin directly
-- updating public.user_roles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN NEW.raw_user_meta_data->>'role' = 'student' THEN 'student'::app_role ELSE 'teacher'::app_role END
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;


-- Fix missing profile for sergio.araujo@ufrn.br
INSERT INTO public.profiles (id, full_name, email, is_approved)
VALUES ('84ef233b-2031-4b35-88c7-375af9f73803', 'SERGIO ARAUJO', 'sergio.araujo@ufrn.br', true)
ON CONFLICT (id) DO NOTHING;

-- Fix missing role
INSERT INTO public.user_roles (user_id, role)
VALUES ('84ef233b-2031-4b35-88c7-375af9f73803', 'teacher')
ON CONFLICT (user_id, role) DO NOTHING;

-- Recreate the trigger to ensure it works for future users
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
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'teacher')::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

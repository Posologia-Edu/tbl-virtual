
-- 1. Confirm the existing user's email and create their profile/role
UPDATE auth.users 
SET email_confirmed_at = now(), 
    raw_user_meta_data = jsonb_set(
      jsonb_set(raw_user_meta_data, '{email_verified}', 'true'),
      '{full_name}', '"Sérgio Ricardo Fernandes de Araújo"'
    ),
    raw_app_meta_data = jsonb_set(raw_app_meta_data, '{role}', '"teacher"')
WHERE id = '18a18a77-d2e9-4abc-9bab-f6cc9fc51e73';

INSERT INTO public.profiles (id, full_name)
VALUES ('18a18a77-d2e9-4abc-9bab-f6cc9fc51e73', 'Sérgio Ricardo Fernandes de Araújo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('18a18a77-d2e9-4abc-9bab-f6cc9fc51e73', 'teacher')
ON CONFLICT DO NOTHING;

-- 2. Create trigger function to auto-create profile and role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(NEW.raw_app_meta_data->>'role', 'student')::app_role);

  RETURN NEW;
END;
$$;

-- 3. Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

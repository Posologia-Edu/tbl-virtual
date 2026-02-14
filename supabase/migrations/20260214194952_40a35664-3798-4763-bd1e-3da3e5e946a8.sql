
-- Fix team_members FK to reference profiles instead of auth.users
ALTER TABLE public.team_members DROP CONSTRAINT team_members_user_id_fkey;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

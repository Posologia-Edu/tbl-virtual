
-- Enable Supabase Realtime for key tables so teachers and students get live updates
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.irat_responses;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.trat_attempts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.application_questions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.application_responses;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enable REPLICA IDENTITY FULL for tables that need UPDATE/DELETE tracking
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_participants REPLICA IDENTITY FULL;
ALTER TABLE public.teams REPLICA IDENTITY FULL;
ALTER TABLE public.team_members REPLICA IDENTITY FULL;

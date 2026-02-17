
-- Add timer columns for tRAT and Application phases
ALTER TABLE public.rooms ADD COLUMN trat_end_time timestamp with time zone;
ALTER TABLE public.rooms ADD COLUMN app_end_time timestamp with time zone;

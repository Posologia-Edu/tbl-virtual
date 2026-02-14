
-- Add application_pct column to rooms
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS application_pct integer DEFAULT 30;

-- Update defaults for individual_pct and team_pct to match TBL standard
ALTER TABLE public.rooms ALTER COLUMN individual_pct SET DEFAULT 30;
ALTER TABLE public.rooms ALTER COLUMN team_pct SET DEFAULT 40;


-- Add point distribution columns to irat_responses
ALTER TABLE public.irat_responses
  ADD COLUMN points_a integer NOT NULL DEFAULT 0,
  ADD COLUMN points_b integer NOT NULL DEFAULT 0,
  ADD COLUMN points_c integer NOT NULL DEFAULT 0,
  ADD COLUMN points_d integer NOT NULL DEFAULT 0;

-- Drop the old selected_option and is_correct columns (no longer needed with point distribution)
-- Actually keep selected_option for backward compat but make it nullable
ALTER TABLE public.irat_responses ALTER COLUMN selected_option DROP NOT NULL;
ALTER TABLE public.irat_responses ALTER COLUMN selected_option SET DEFAULT NULL;

-- Add a score column that stores the points the student earned (points on correct option)
ALTER TABLE public.irat_responses ADD COLUMN score integer NOT NULL DEFAULT 0;

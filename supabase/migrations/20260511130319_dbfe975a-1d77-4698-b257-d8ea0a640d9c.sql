ALTER TYPE public.room_stage ADD VALUE IF NOT EXISTS 'application_feedback' AFTER 'application_open';

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS current_app_feedback_index integer NOT NULL DEFAULT 0;
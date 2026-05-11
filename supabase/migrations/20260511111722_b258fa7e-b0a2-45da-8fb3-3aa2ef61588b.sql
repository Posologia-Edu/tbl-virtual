-- Add new room stages
ALTER TYPE public.room_stage ADD VALUE IF NOT EXISTS 'trat_feedback' AFTER 'trat_open';
ALTER TYPE public.room_stage ADD VALUE IF NOT EXISTS 'appeals_open' AFTER 'trat_feedback';

-- Add explanation column to iRAT/tRAT questions
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS explanation TEXT;

-- Add feedback navigation index to rooms
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS current_feedback_index INTEGER NOT NULL DEFAULT 0;
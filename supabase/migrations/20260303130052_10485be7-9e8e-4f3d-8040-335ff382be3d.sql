
-- Add cancelled_at column to rooms for tracking cancellation time
ALTER TABLE public.rooms ADD COLUMN cancelled_at timestamptz DEFAULT NULL;

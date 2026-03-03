
-- Add soft delete columns
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.application_questions ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

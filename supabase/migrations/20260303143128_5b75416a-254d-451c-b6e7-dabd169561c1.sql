ALTER TABLE public.rooms 
  ADD COLUMN IF NOT EXISTS current_app_question_index integer DEFAULT 0;
ALTER TABLE public.rooms 
  ADD COLUMN IF NOT EXISTS app_alternatives_released boolean DEFAULT false;

-- Create student achievements table
CREATE TABLE public.student_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_key TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  achievement_description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏆',
  room_id UUID REFERENCES public.rooms(id),
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_key, room_id)
);

-- Enable RLS
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;

-- Students can view own achievements
CREATE POLICY "Students can view own achievements"
ON public.student_achievements
FOR SELECT
USING (user_id = auth.uid());

-- Students can insert own achievements (earned via client logic)
CREATE POLICY "Students can insert own achievements"
ON public.student_achievements
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Teachers can view achievements of participants in their rooms
CREATE POLICY "Teachers can view room achievements"
ON public.student_achievements
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM rooms WHERE rooms.id = student_achievements.room_id AND rooms.teacher_id = auth.uid()
  )
);

-- Admins can view all
CREATE POLICY "Admins can view all achievements"
ON public.student_achievements
FOR SELECT
USING (is_admin(auth.uid()));

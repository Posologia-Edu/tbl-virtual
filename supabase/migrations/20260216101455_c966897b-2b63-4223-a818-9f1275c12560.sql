
-- Create appeals table for post-tRAT team appeals
CREATE TABLE public.appeals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  justification text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  teacher_response text,
  submitted_by uuid NOT NULL,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  UNIQUE(room_id, team_id, question_id)
);

-- Enable RLS
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

-- Team members can submit and view their own appeals
CREATE POLICY "Team members can manage appeals"
ON public.appeals FOR ALL
USING (EXISTS (
  SELECT 1 FROM team_members
  WHERE team_members.team_id = appeals.team_id
  AND team_members.user_id = auth.uid()
));

-- Teachers can view and manage appeals in their rooms
CREATE POLICY "Teachers can manage appeals"
ON public.appeals FOR ALL
USING (EXISTS (
  SELECT 1 FROM rooms
  WHERE rooms.id = appeals.room_id
  AND rooms.teacher_id = auth.uid()
));

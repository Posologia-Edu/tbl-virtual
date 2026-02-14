
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('teacher', 'student');

-- Room stage enum
CREATE TYPE public.room_stage AS ENUM ('waiting', 'irat_open', 'trat_open', 'application_open', 'finished');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Rooms table
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code CHAR(6) NOT NULL UNIQUE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  current_stage room_stage NOT NULL DEFAULT 'waiting',
  is_active BOOLEAN NOT NULL DEFAULT true,
  quiz_id UUID, -- will add FK after quizzes table
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage own rooms" ON public.rooms FOR ALL TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "Students can view active rooms" ON public.rooms FOR SELECT TO authenticated USING (is_active = true);

-- Teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  UNIQUE (room_id, name)
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone in room can view teams" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can manage teams" ON public.teams FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = room_id AND rooms.teacher_id = auth.uid())
);

-- Team members
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, room_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view team members" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Students can join teams" ON public.team_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Students can leave teams" ON public.team_members FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Quizzes table
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own quizzes" ON public.quizzes FOR ALL TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "Students can view quizzes in their rooms" ON public.quizzes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.rooms r JOIN public.team_members tm ON tm.room_id = r.id WHERE r.quiz_id = quizzes.id AND tm.user_id = auth.uid())
);

-- Add FK from rooms to quizzes
ALTER TABLE public.rooms ADD CONSTRAINT rooms_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id);

-- Questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A','B','C','D')),
  sort_order INT NOT NULL DEFAULT 0
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage questions" ON public.questions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.quizzes WHERE quizzes.id = quiz_id AND quizzes.teacher_id = auth.uid())
);
CREATE POLICY "Students can view questions in active rooms" ON public.questions FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    JOIN public.rooms r ON r.quiz_id = q.id
    JOIN public.team_members tm ON tm.room_id = r.id
    WHERE q.id = quiz_id AND tm.user_id = auth.uid() AND r.current_stage != 'waiting'
  )
);

-- iRAT responses
CREATE TABLE public.irat_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  selected_option CHAR(1) NOT NULL CHECK (selected_option IN ('A','B','C','D')),
  is_correct BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, question_id, room_id)
);
ALTER TABLE public.irat_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage own irat responses" ON public.irat_responses FOR ALL TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Teachers can view irat responses" ON public.irat_responses FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = room_id AND rooms.teacher_id = auth.uid())
);

-- tRAT attempts
CREATE TABLE public.trat_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  attempt_number INT NOT NULL CHECK (attempt_number BETWEEN 1 AND 4),
  selected_option CHAR(1) NOT NULL CHECK (selected_option IN ('A','B','C','D')),
  is_correct BOOLEAN NOT NULL DEFAULT false,
  submitted_by UUID REFERENCES auth.users(id) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, question_id, attempt_number, room_id)
);
ALTER TABLE public.trat_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can view trat attempts" ON public.trat_attempts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.team_members WHERE team_members.team_id = trat_attempts.team_id AND team_members.user_id = auth.uid())
);
CREATE POLICY "Team members can insert trat attempts" ON public.trat_attempts FOR INSERT TO authenticated WITH CHECK (
  submitted_by = auth.uid() AND
  EXISTS (SELECT 1 FROM public.team_members WHERE team_members.team_id = trat_attempts.team_id AND team_members.user_id = auth.uid())
);
CREATE POLICY "Teachers can view trat attempts" ON public.trat_attempts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = room_id AND rooms.teacher_id = auth.uid())
);

-- Application questions
CREATE TABLE public.application_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  sort_order INT NOT NULL DEFAULT 0
);
ALTER TABLE public.application_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage app questions" ON public.application_questions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = room_id AND rooms.teacher_id = auth.uid())
);
CREATE POLICY "Students view app questions" ON public.application_questions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.room_id = application_questions.room_id AND tm.user_id = auth.uid())
);

-- Application responses
CREATE TABLE public.application_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.application_questions(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  selected_option CHAR(1) CHECK (selected_option IN ('A','B','C','D')),
  submitted_by UUID REFERENCES auth.users(id) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, team_id)
);
ALTER TABLE public.application_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can manage app responses" ON public.application_responses FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.team_members WHERE team_members.team_id = application_responses.team_id AND team_members.user_id = auth.uid())
);
CREATE POLICY "Teachers view app responses" ON public.application_responses FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = room_id AND rooms.teacher_id = auth.uid())
);

-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trat_attempts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.application_responses;

-- Function to generate room codes
CREATE OR REPLACE FUNCTION public.generate_room_code()
RETURNS CHAR(6)
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

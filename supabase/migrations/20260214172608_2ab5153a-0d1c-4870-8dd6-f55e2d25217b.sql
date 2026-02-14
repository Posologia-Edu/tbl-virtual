
-- Fix RLS policies: Change from RESTRICTIVE to PERMISSIVE (default)
-- The issue is all policies are RESTRICTIVE, meaning ALL must pass (AND logic)
-- They should be PERMISSIVE so ANY matching policy grants access (OR logic)

-- === ROOMS ===
DROP POLICY IF EXISTS "Students can view active rooms" ON public.rooms;
DROP POLICY IF EXISTS "Teachers can manage own rooms" ON public.rooms;

CREATE POLICY "Students can view active rooms" ON public.rooms
  FOR SELECT USING (is_active = true);

CREATE POLICY "Teachers can manage own rooms" ON public.rooms
  FOR ALL USING (teacher_id = auth.uid());

-- === ROOM_PARTICIPANTS ===
DROP POLICY IF EXISTS "Anyone can view room participants" ON public.room_participants;
DROP POLICY IF EXISTS "Students can join rooms" ON public.room_participants;
DROP POLICY IF EXISTS "Students can leave rooms" ON public.room_participants;
DROP POLICY IF EXISTS "Teachers can view participants" ON public.room_participants;

CREATE POLICY "Anyone can view room participants" ON public.room_participants
  FOR SELECT USING (true);

CREATE POLICY "Students can join rooms" ON public.room_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Students can leave rooms" ON public.room_participants
  FOR DELETE USING (user_id = auth.uid());

-- === TEAM_MEMBERS ===
DROP POLICY IF EXISTS "Anyone can view team members" ON public.team_members;
DROP POLICY IF EXISTS "Students can join teams" ON public.team_members;
DROP POLICY IF EXISTS "Students can leave teams" ON public.team_members;

CREATE POLICY "Anyone can view team members" ON public.team_members
  FOR SELECT USING (true);

CREATE POLICY "Students can join teams" ON public.team_members
  FOR INSERT WITH CHECK (user_id = auth.uid() OR is_team_member(team_id, auth.uid()));

CREATE POLICY "Students can leave teams" ON public.team_members
  FOR DELETE USING (user_id = auth.uid());

-- === TEAMS ===
DROP POLICY IF EXISTS "Anyone in room can view teams" ON public.teams;
DROP POLICY IF EXISTS "Students can create teams in their rooms" ON public.teams;
DROP POLICY IF EXISTS "Teachers can manage teams" ON public.teams;

CREATE POLICY "Anyone in room can view teams" ON public.teams
  FOR SELECT USING (true);

CREATE POLICY "Students can create teams in their rooms" ON public.teams
  FOR INSERT WITH CHECK (is_room_participant(room_id, auth.uid()));

CREATE POLICY "Teachers can manage teams" ON public.teams
  FOR ALL USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = teams.room_id AND rooms.teacher_id = auth.uid()));

-- === PROFILES ===
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Anyone can view profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- === QUESTIONS ===
DROP POLICY IF EXISTS "Students can view questions in active rooms" ON public.questions;
DROP POLICY IF EXISTS "Teachers manage questions" ON public.questions;

CREATE POLICY "Students can view questions in active rooms" ON public.questions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM quizzes q
    JOIN rooms r ON r.quiz_id = q.id
    JOIN room_participants rp ON rp.room_id = r.id
    WHERE q.id = questions.quiz_id AND rp.user_id = auth.uid() AND r.current_stage <> 'waiting'::room_stage
  ));

CREATE POLICY "Teachers manage questions" ON public.questions
  FOR ALL USING (EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = questions.quiz_id AND quizzes.teacher_id = auth.uid()));

-- === QUIZZES ===
DROP POLICY IF EXISTS "Students can view quizzes in their rooms" ON public.quizzes;
DROP POLICY IF EXISTS "Teachers manage own quizzes" ON public.quizzes;

CREATE POLICY "Students can view quizzes in their rooms" ON public.quizzes
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM rooms r
    JOIN room_participants rp ON rp.room_id = r.id
    WHERE r.quiz_id = quizzes.id AND rp.user_id = auth.uid()
  ));

CREATE POLICY "Teachers manage own quizzes" ON public.quizzes
  FOR ALL USING (teacher_id = auth.uid());

-- === IRAT_RESPONSES ===
DROP POLICY IF EXISTS "Students manage own irat responses" ON public.irat_responses;
DROP POLICY IF EXISTS "Teachers can view irat responses" ON public.irat_responses;

CREATE POLICY "Students manage own irat responses" ON public.irat_responses
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Teachers can view irat responses" ON public.irat_responses
  FOR SELECT USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = irat_responses.room_id AND rooms.teacher_id = auth.uid()));

-- === TRAT_ATTEMPTS ===
DROP POLICY IF EXISTS "Teachers can view trat attempts" ON public.trat_attempts;
DROP POLICY IF EXISTS "Team members can insert trat attempts" ON public.trat_attempts;
DROP POLICY IF EXISTS "Team members can view trat attempts" ON public.trat_attempts;

CREATE POLICY "Teachers can view trat attempts" ON public.trat_attempts
  FOR SELECT USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = trat_attempts.room_id AND rooms.teacher_id = auth.uid()));

CREATE POLICY "Team members can insert trat attempts" ON public.trat_attempts
  FOR INSERT WITH CHECK (submitted_by = auth.uid() AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = trat_attempts.team_id AND team_members.user_id = auth.uid()));

CREATE POLICY "Team members can view trat attempts" ON public.trat_attempts
  FOR SELECT USING (EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = trat_attempts.team_id AND team_members.user_id = auth.uid()));

-- === APPLICATION_QUESTIONS ===
DROP POLICY IF EXISTS "Students view app questions" ON public.application_questions;
DROP POLICY IF EXISTS "Teachers manage app questions" ON public.application_questions;

CREATE POLICY "Students view app questions" ON public.application_questions
  FOR SELECT USING (EXISTS (SELECT 1 FROM room_participants rp WHERE rp.room_id = application_questions.room_id AND rp.user_id = auth.uid()));

CREATE POLICY "Teachers manage app questions" ON public.application_questions
  FOR ALL USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = application_questions.room_id AND rooms.teacher_id = auth.uid()));

-- === APPLICATION_RESPONSES ===
DROP POLICY IF EXISTS "Teachers view app responses" ON public.application_responses;
DROP POLICY IF EXISTS "Team members can manage app responses" ON public.application_responses;

CREATE POLICY "Teachers view app responses" ON public.application_responses
  FOR SELECT USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = application_responses.room_id AND rooms.teacher_id = auth.uid()));

CREATE POLICY "Team members can manage app responses" ON public.application_responses
  FOR ALL USING (EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = application_responses.team_id AND team_members.user_id = auth.uid()));

-- === USER_ROLES ===
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can insert own role" ON public.user_roles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Server-side enforcement of the free-plan quotas advertised on the pricing
-- page ("Até 30 alunos", "3 salas ativas/mês", "Até 3 questionários",
-- "Até 5 questões por questionário"). These were previously only checked in
-- the React client (TeacherDashboard.tsx / QuizManager.tsx), so any request
-- sent straight to the PostgREST API with a valid user JWT could bypass every
-- limit. Triggers here make the database itself the source of truth.
--
-- Plan resolution mirrors generate-quiz-ai's getUserPlanLimit(): system
-- admins count as institutional; otherwise the active row in
-- manual_subscriptions (kept in sync with Stripe by check-subscription on
-- every app load) decides the plan; missing/expired/free rows default to
-- 'free'. Only the free plan has caps — pro/institutional are Infinity for
-- all four limits in src/lib/stripe-plans.ts, so triggers skip the check
-- entirely once the plan isn't 'free'.

CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN 'free'
    WHEN public.is_admin(_user_id) THEN 'institutional'
    ELSE COALESCE(
      (SELECT plan FROM public.manual_subscriptions
       WHERE user_id = _user_id
         AND plan <> 'free'
         AND (expires_at IS NULL OR expires_at > now())),
      'free'
    )
  END
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_plan(uuid) TO authenticated;

-- Rooms: free plan gets 3 created per calendar month (mirrors the "/mês"
-- reset used by the AI quota elsewhere). Counts ALL rooms including
-- soft-deleted ones so moving a room to the trash can't be used to create
-- more than 3 in the same month.
CREATE OR REPLACE FUNCTION public.enforce_room_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  room_count integer;
BEGIN
  IF public.get_user_plan(NEW.teacher_id) = 'free' THEN
    SELECT count(*) INTO room_count
    FROM public.rooms
    WHERE teacher_id = NEW.teacher_id
      AND created_at >= date_trunc('month', now());

    IF room_count >= 3 THEN
      RAISE EXCEPTION 'PLAN_LIMIT: O plano Gratuito permite até 3 salas por mês. Faça upgrade para criar mais.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_room_quota ON public.rooms;
CREATE TRIGGER trg_enforce_room_quota
BEFORE INSERT ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.enforce_room_quota();

-- Quizzes: free plan gets 3 in the question bank at a time (standing
-- inventory, not a monthly quota — matches the client-side check that
-- counts non-deleted quizzes).
CREATE OR REPLACE FUNCTION public.enforce_quiz_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quiz_count integer;
BEGIN
  IF public.get_user_plan(NEW.teacher_id) = 'free' THEN
    SELECT count(*) INTO quiz_count
    FROM public.quizzes
    WHERE teacher_id = NEW.teacher_id
      AND deleted_at IS NULL;

    IF quiz_count >= 3 THEN
      RAISE EXCEPTION 'PLAN_LIMIT: O plano Gratuito permite até 3 questionários. Faça upgrade para criar mais.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_quiz_quota ON public.quizzes;
CREATE TRIGGER trg_enforce_quiz_quota
BEFORE INSERT ON public.quizzes
FOR EACH ROW EXECUTE FUNCTION public.enforce_quiz_quota();

-- Questions: free plan gets 5 combined iRAT/tRAT + Aplicação questions per
-- quiz. Scoped to quiz_id (the quiz's reusable question bank/template) —
-- application_questions rows with quiz_id NULL are room-scoped live copies
-- or in-session additions (see TeacherRoomManage.tsx), not part of a
-- "questionário", so they're intentionally not gated here.
CREATE OR REPLACE FUNCTION public.enforce_question_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
  question_count integer;
BEGIN
  IF NEW.quiz_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT teacher_id INTO v_teacher_id FROM public.quizzes WHERE id = NEW.quiz_id;

  IF public.get_user_plan(v_teacher_id) = 'free' THEN
    SELECT
      (SELECT count(*) FROM public.questions WHERE quiz_id = NEW.quiz_id AND deleted_at IS NULL) +
      (SELECT count(*) FROM public.application_questions WHERE quiz_id = NEW.quiz_id AND deleted_at IS NULL)
    INTO question_count;

    IF question_count >= 5 THEN
      RAISE EXCEPTION 'PLAN_LIMIT: O plano Gratuito permite até 5 questões por questionário. Faça upgrade para adicionar mais.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_question_quota ON public.questions;
CREATE TRIGGER trg_enforce_question_quota
BEFORE INSERT ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.enforce_question_quota();

DROP TRIGGER IF EXISTS trg_enforce_app_question_quota ON public.application_questions;
CREATE TRIGGER trg_enforce_app_question_quota
BEFORE INSERT ON public.application_questions
FOR EACH ROW EXECUTE FUNCTION public.enforce_question_quota();

-- Students: free plan gets 30 distinct students across all of a teacher's
-- rooms. A student who already participates in one of the teacher's rooms
-- doesn't count again when joining another of that teacher's rooms.
CREATE OR REPLACE FUNCTION public.enforce_student_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
  student_count integer;
BEGIN
  SELECT teacher_id INTO v_teacher_id FROM public.rooms WHERE id = NEW.room_id;

  IF public.get_user_plan(v_teacher_id) = 'free' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.room_participants rp
      JOIN public.rooms r ON r.id = rp.room_id
      WHERE r.teacher_id = v_teacher_id AND rp.user_id = NEW.user_id
    ) THEN
      SELECT count(DISTINCT rp.user_id) INTO student_count
      FROM public.room_participants rp
      JOIN public.rooms r ON r.id = rp.room_id
      WHERE r.teacher_id = v_teacher_id;

      IF student_count >= 30 THEN
        RAISE EXCEPTION 'PLAN_LIMIT: O plano Gratuito permite até 30 alunos. Peça ao professor para fazer upgrade do plano.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_student_quota ON public.room_participants;
CREATE TRIGGER trg_enforce_student_quota
BEFORE INSERT ON public.room_participants
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_quota();

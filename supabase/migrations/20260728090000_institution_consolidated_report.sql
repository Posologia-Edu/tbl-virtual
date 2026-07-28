-- "Relatórios consolidados" for the Institutional plan (src/lib/stripe-plans.ts)
-- was previously just marketing text: the only "consolidated" report in the
-- app (ClassManagement's "Boletim Consolidado") is per-class and available
-- to every plan, not an institution-wide view across a plan owner's linked
-- teachers. This adds a real one.
--
-- Deliberately implemented as a single SECURITY DEFINER RPC that returns
-- pre-aggregated numbers per teacher, rather than granting the institution
-- owner broad new RLS SELECT policies on rooms/irat_responses/trat_attempts.
-- That keeps the blast radius small: an institution owner never gets
-- row-level read access to another teacher's individual student data
-- (names, per-question answers) — only counts and accuracy percentages.

CREATE OR REPLACE FUNCTION public.get_institution_report()
RETURNS TABLE (
  teacher_id uuid,
  teacher_name text,
  total_rooms bigint,
  finished_rooms bigint,
  unique_students bigint,
  irat_accuracy_pct numeric,
  trat_accuracy_pct numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF NOT (public.is_admin(caller) OR public.get_user_plan(caller) = 'institutional') THEN
    RAISE EXCEPTION 'FORBIDDEN: apenas donos do plano Institucional podem ver o relatório consolidado.';
  END IF;

  RETURN QUERY
  WITH teacher_ids AS (
    SELECT caller AS id
    UNION
    SELECT ms.user_id FROM public.manual_subscriptions ms WHERE ms.granted_by = caller
  ),
  room_stats AS (
    SELECT
      r.teacher_id AS id,
      count(*) AS total_rooms,
      count(*) FILTER (WHERE r.current_stage = 'finished') AS finished_rooms
    FROM public.rooms r
    WHERE r.teacher_id IN (SELECT id FROM teacher_ids) AND r.deleted_at IS NULL
    GROUP BY r.teacher_id
  ),
  student_stats AS (
    SELECT r.teacher_id AS id, count(DISTINCT rp.user_id) AS unique_students
    FROM public.rooms r
    JOIN public.room_participants rp ON rp.room_id = r.id
    WHERE r.teacher_id IN (SELECT id FROM teacher_ids) AND r.deleted_at IS NULL
    GROUP BY r.teacher_id
  ),
  irat_stats AS (
    SELECT r.teacher_id AS id,
      round(100.0 * count(*) FILTER (WHERE ir.is_correct) / NULLIF(count(*), 0), 1) AS irat_accuracy_pct
    FROM public.rooms r
    JOIN public.irat_responses ir ON ir.room_id = r.id
    WHERE r.teacher_id IN (SELECT id FROM teacher_ids) AND r.deleted_at IS NULL
    GROUP BY r.teacher_id
  ),
  trat_stats AS (
    SELECT r.teacher_id AS id,
      round(100.0 * count(*) FILTER (WHERE ta.is_correct) / NULLIF(count(*), 0), 1) AS trat_accuracy_pct
    FROM public.rooms r
    JOIN public.trat_attempts ta ON ta.room_id = r.id
    WHERE r.teacher_id IN (SELECT id FROM teacher_ids) AND r.deleted_at IS NULL
    GROUP BY r.teacher_id
  )
  SELECT
    t.id,
    COALESCE(p.full_name, '—'),
    COALESCE(rs.total_rooms, 0),
    COALESCE(rs.finished_rooms, 0),
    COALESCE(ss.unique_students, 0),
    is_.irat_accuracy_pct,
    ts.trat_accuracy_pct
  FROM teacher_ids t
  LEFT JOIN public.profiles p ON p.id = t.id
  LEFT JOIN room_stats rs ON rs.id = t.id
  LEFT JOIN student_stats ss ON ss.id = t.id
  LEFT JOIN irat_stats is_ ON is_.id = t.id
  LEFT JOIN trat_stats ts ON ts.id = t.id
  ORDER BY 2;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_institution_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_institution_report() TO authenticated;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

// Called by an external system (a WhatsApp AI-agent platform, wp.agents) to
// let a "performance consultant" agent look up a student's own TBL results
// by e-mail. Mirrors, on purpose, the student-performance function already
// shipped in the sibling posologia-clinical-hub (simulador), prova.facil and
// PBL Flow repos — same two-step e-mail+code verification shape, same
// shared-secret auth header — so the wp.agents side reuses the same
// integration/prompt pattern for all platforms.
//
// Two-step flow, to stop a classmate from reading someone else's grades by
// just typing their e-mail (there's no other identity check on the WhatsApp
// side — the agent only knows what the conversation tells it):
//   1. Called with only `email` -> generates a 6-digit code, e-mails it to
//      that address, returns {status:"code_sent"}. The agent is expected to
//      ask the student for the code they received.
//   2. Called with `email` + `code` -> validates the code (correct, not
//      expired, not already used, capped attempts) and only then returns
//      the actual results.
//
// TBL-specific wrinkles (see JoinRoomPage.tsx's signUp-then-signIn-with-a-
// fresh-random-password fallback): a real student e-mail can end up spread
// across MULTIPLE `profiles` rows, one per room join, because the sign-in
// retry can never actually succeed (the password is regenerated every
// attempt) and falls back to creating a brand-new auth.users row under a
// fabricated `@student.tbl` address, then overwrites just `profiles.email`
// with the real one. So identity here is resolved by scanning `profiles.email`
// (not `auth.admin.listUsers`, which only matches the *first* row a student
// ever created) and treated as a SET of profile ids, never a single one.
//
// iRAT is individually scored and safe to report 1:1 ("you got question X
// right/wrong"). tRAT and the application-of-concepts stage are scored per
// TEAM (`trat_attempts`/`application_responses` keyed by team_id, not
// student_id) — reported with "sua equipe" framing, never "você", since the
// score reflects the whole team, not just this student. Application-stage
// correctness is only revealed once the room's stage has actually reached
// the feedback stage, mirroring the same masking the app's own
// `get_room_application_questions` RPC applies, so this tool can't be used
// to peek at the answer key before the teacher releases it.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wpagents-key",
};

const CODE_TTL_MINUTES = 10;
const MAX_CODE_REQUESTS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;
const FROM_EMAIL = "TBL Virtual <noreply@tbl.posologia.app>";

// IF-AT scratch-card scoring: 1st try correct = 4 pts, 2nd = 2, 3rd = 1, 4th = 0.
const TRAT_WEIGHT_BY_ATTEMPT = [4, 2, 1, 0];
const APPLICATION_FEEDBACK_STAGES = ["application_feedback", "finished"];

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendVerificationEmail(email: string, code: string) {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [email],
    subject: "Seu código de verificação — Consultor de Desempenho",
    html: `
      <p>Olá!</p>
      <p>Alguém (esperamos que você 😊) pediu para consultar seu desempenho recente no TBL Virtual pelo assistente no WhatsApp.</p>
      <p>Seu código de verificação é:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
      <p>Ele expira em ${CODE_TTL_MINUTES} minutos. Se você não pediu isso, pode ignorar este e-mail.</p>
    `,
  });
  if (error) throw new Error(typeof error === "string" ? error : error.message || "Falha ao enviar e-mail");
}

// A correct application-question answer can be authored either as A/B/C/D or
// as V(erdadeiro)/F(also) — send-report-email/index.ts already established
// this mapping (V<->A, F<->B) for straight-multiple-choice-shaped app
// questions, kept identical here so the two reports never disagree.
function isApplicationAnswerCorrect(correctAnswer: string | null, selected: string | null) {
  if (!correctAnswer || !selected) return false;
  if (correctAnswer === "V") return selected === "A";
  if (correctAnswer === "F") return selected === "B";
  return selected === correctAnswer;
}

async function findStudentPerformance(supabase: any, email: string) {
  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email);
  if (profilesErr) throw profilesErr;

  const profileIds: string[] = (profiles || []).map((p: any) => p.id);
  if (profileIds.length === 0) {
    return { aluno_email: email, encontrado: false, salas: [] };
  }

  const { data: iratRows, error: iratErr } = await supabase
    .from("irat_responses")
    .select("room_id, question_id, score, is_correct, submitted_at, questions(question_text, sort_order, explanation)")
    .in("student_id", profileIds);
  if (iratErr) throw iratErr;

  const { data: teamRows, error: teamErr } = await supabase
    .from("team_members")
    .select("room_id, team_id, teams(name)")
    .in("user_id", profileIds);
  if (teamErr) throw teamErr;

  // One team per room per student, in principle — but a fragmented student
  // (section above) could in theory show up on two different profile ids in
  // the same room's team_members. Keep the first one found; a genuine
  // duplicate would mean the same person on two teams in one room, which the
  // app itself doesn't support (UNIQUE(user_id, room_id)) per profile id.
  const teamByRoom = new Map<string, { teamId: string; teamName: string }>();
  for (const t of teamRows || []) {
    if (!teamByRoom.has(t.room_id)) {
      teamByRoom.set(t.room_id, { teamId: t.team_id, teamName: t.teams?.name || null });
    }
  }

  const roomIds = Array.from(new Set([...(iratRows || []).map((r: any) => r.room_id), ...teamByRoom.keys()]));
  if (roomIds.length === 0) {
    return { aluno_email: email, encontrado: false, salas: [] };
  }

  const { data: rooms, error: roomsErr } = await supabase
    .from("rooms")
    .select("id, name, current_stage, quiz_id, max_grade, individual_pct, team_pct, application_pct")
    .in("id", roomIds);
  if (roomsErr) throw roomsErr;

  const quizIds = Array.from(new Set((rooms || []).map((r: any) => r.quiz_id).filter(Boolean)));
  const { data: quizQuestions, error: quizQErr } = quizIds.length
    ? await supabase.from("questions").select("id, quiz_id").in("quiz_id", quizIds).is("deleted_at", null)
    : { data: [], error: null };
  if (quizQErr) throw quizQErr;
  const questionCountByQuiz = new Map<string, number>();
  for (const q of quizQuestions || []) {
    questionCountByQuiz.set(q.quiz_id, (questionCountByQuiz.get(q.quiz_id) || 0) + 1);
  }

  const teamIds = Array.from(new Set(Array.from(teamByRoom.values()).map((t) => t.teamId)));
  const { data: tratRows, error: tratErr } = teamIds.length
    ? await supabase
        .from("trat_attempts")
        .select("room_id, team_id, question_id, attempt_number, is_correct")
        .in("team_id", teamIds)
    : { data: [], error: null };
  if (tratErr) throw tratErr;

  const { data: appQuestions, error: appQErr } = await supabase
    .from("application_questions")
    .select("id, room_id, quiz_id, sort_order, correct_answer")
    .or([...roomIds.map((id) => `room_id.eq.${id}`), ...quizIds.map((id) => `quiz_id.eq.${id}`)].join(","))
    .is("deleted_at", null);
  if (appQErr) throw appQErr;

  const { data: appResponses, error: appRespErr } = teamIds.length
    ? await supabase
        .from("application_responses")
        .select("room_id, team_id, question_id, selected_option")
        .in("team_id", teamIds)
    : { data: [], error: null };
  if (appRespErr) throw appRespErr;

  const salas = rooms.map((room: any) => {
    const maxGrade = room.max_grade ?? 10;
    const individualPct = (room.individual_pct ?? 30) / 100;
    const teamPct = (room.team_pct ?? 40) / 100;
    const applicationPct = (room.application_pct ?? 30) / 100;
    const quizQuestionCount = questionCountByQuiz.get(room.quiz_id) || 0;

    const roomIrat = (iratRows || [])
      .filter((r: any) => r.room_id === room.id)
      .sort((a: any, b: any) => (a.questions?.sort_order ?? 0) - (b.questions?.sort_order ?? 0));
    const iratRaw = roomIrat.reduce((sum: number, r: any) => sum + (r.score || 0), 0);
    const iratMax = quizQuestionCount * 4;
    const explanationsUnlocked = room.current_stage !== "waiting";

    const team = teamByRoom.get(room.id) || null;

    let tratDetalhes: any[] = [];
    let tratRaw = 0;
    const tratMax = quizQuestionCount * 4;
    if (team) {
      const byQuestion = new Map<string, any[]>();
      for (const a of tratRows || []) {
        if (a.room_id !== room.id || a.team_id !== team.teamId) continue;
        const list = byQuestion.get(a.question_id) || [];
        list.push(a);
        byQuestion.set(a.question_id, list);
      }
      for (const attempts of byQuestion.values()) {
        const correctAttempt = attempts.find((a) => a.is_correct);
        const pontos = correctAttempt ? TRAT_WEIGHT_BY_ATTEMPT[correctAttempt.attempt_number - 1] || 0 : 0;
        tratRaw += pontos;
        tratDetalhes.push({
          acertou: !!correctAttempt,
          tentativas: attempts.length,
          pontos,
        });
      }
    }

    const appFeedbackReleased = APPLICATION_FEEDBACK_STAGES.includes(room.current_stage);
    let appDetalhes: any[] = [];
    let appRaw = 0;
    const roomAppQuestions = (appQuestions || []).filter(
      (q: any) => q.room_id === room.id || (!q.room_id && q.quiz_id === room.quiz_id)
    );
    const appMax = roomAppQuestions.length;
    if (team && appFeedbackReleased) {
      for (const q of roomAppQuestions) {
        const response = (appResponses || []).find((r: any) => r.room_id === room.id && r.team_id === team.teamId && r.question_id === q.id);
        const acertou = isApplicationAnswerCorrect(q.correct_answer, response?.selected_option || null);
        if (acertou) appRaw += 1;
        appDetalhes.push({ respondida: !!response, acertou });
      }
    }

    const iratNota = iratMax > 0 ? (iratRaw / iratMax) * maxGrade * individualPct : 0;
    const tratNota = tratMax > 0 && team ? (tratRaw / tratMax) * maxGrade * teamPct : 0;
    const appNota = appMax > 0 && team && appFeedbackReleased ? (appRaw / appMax) * maxGrade * applicationPct : 0;

    return {
      sala: room.name,
      status: room.current_stage,
      irat: {
        questoes_respondidas: roomIrat.length,
        total_questoes: quizQuestionCount,
        acertos: roomIrat.filter((r: any) => r.is_correct).length,
        pontuacao_bruta: iratRaw,
        pontuacao_maxima: iratMax,
        detalhes: roomIrat.map((r: any) => ({
          questao: r.questions?.question_text || null,
          acertou: r.is_correct,
          pontos: r.score,
          explicacao: explanationsUnlocked ? r.questions?.explanation || null : null,
        })),
      },
      equipe: team
        ? {
            nome: team.teamName,
            trat: {
              questoes_respondidas: tratDetalhes.length,
              total_questoes: quizQuestionCount,
              pontuacao_bruta: tratRaw,
              pontuacao_maxima: tratMax,
              detalhes: tratDetalhes,
            },
            aplicacao: appFeedbackReleased
              ? {
                  total_questoes: appMax,
                  acertos: appRaw,
                  detalhes: appDetalhes,
                }
              : { status: "resultado ainda não liberado pelo professor" },
          }
        : null,
      nota: {
        irat: Math.round(iratNota * 100) / 100,
        trat: Math.round(tratNota * 100) / 100,
        aplicacao: Math.round(appNota * 100) / 100,
        total: Math.round((iratNota + tratNota + appNota) * 100) / 100,
        nota_maxima: maxGrade,
      },
    };
  });

  return { aluno_email: email, encontrado: true, salas };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const expectedKey = Deno.env.get("WPAGENTS_API_KEY");
    const providedKey = req.headers.get("x-wpagents-key");
    if (!expectedKey || providedKey !== expectedKey) {
      return json({ error: "Unauthorized" }, 401);
    }

    const url = new URL(req.url);
    let email = url.searchParams.get("email");
    let code = url.searchParams.get("code");
    if (!email && req.method === "POST") {
      try {
        const body = await req.json();
        email = body?.email ?? null;
        code = body?.code ?? code;
      } catch {
        // no/invalid JSON body — email stays null, handled below
      }
    }
    email = (email || "").trim().toLowerCase();
    code = (code || "").trim();

    if (!email || !email.includes("@")) {
      return json({ error: "Parâmetro 'email' ausente ou inválido." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Step 2: a code was provided — verify it, then return results ──
    if (code) {
      const { data: pending, error: codeErr } = await supabase
        .from("wpagents_verification_codes")
        .select("id, code, expires_at, consumed_at, attempts")
        .ilike("email", email)
        .is("consumed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (codeErr) throw codeErr;

      if (!pending || new Date(pending.expires_at) < new Date()) {
        return json({
          status: "invalid_code",
          mensagem: "Não há um código válido para esse e-mail (expirado ou nunca solicitado). Peça um novo código.",
        });
      }
      if (pending.attempts >= MAX_VERIFY_ATTEMPTS) {
        return json({
          status: "too_many_attempts",
          mensagem: "Esse código foi tentado várias vezes sem sucesso. Peça um novo código.",
        });
      }
      if (pending.code !== code) {
        await supabase
          .from("wpagents_verification_codes")
          .update({ attempts: pending.attempts + 1 })
          .eq("id", pending.id);
        return json({
          status: "wrong_code",
          mensagem: "Código incorreto. Confirme o código recebido por e-mail e tente novamente.",
        });
      }

      // Correct — single-use, mark consumed so it can't be replayed.
      await supabase
        .from("wpagents_verification_codes")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", pending.id);

      const result = await findStudentPerformance(supabase, email);
      return json({ status: "verified", ...result });
    }

    // ── Step 1: no code yet — rate-limit, generate one, e-mail it ──
    const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount, error: countErr } = await supabase
      .from("wpagents_verification_codes")
      .select("id", { count: "exact", head: true })
      .ilike("email", email)
      .gte("created_at", sinceHour);
    if (countErr) throw countErr;
    if ((recentCount || 0) >= MAX_CODE_REQUESTS_PER_HOUR) {
      return json({
        status: "rate_limited",
        mensagem: "Muitos códigos pedidos recentemente para esse e-mail. Peça para tentar novamente em uma hora.",
      });
    }

    const newCode = generateCode();
    const { error: insertErr } = await supabase.from("wpagents_verification_codes").insert({
      email,
      code: newCode,
      expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString(),
    });
    if (insertErr) throw insertErr;

    await sendVerificationEmail(email, newCode);

    return json({
      status: "code_sent",
      mensagem: `Um código de verificação foi enviado para ${email}. Peça ao aluno o código de 6 dígitos recebido, e chame esta mesma ferramenta de novo com o e-mail e o código.`,
    });
  } catch (err) {
    console.error("student-performance error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

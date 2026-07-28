import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, CORS_HEADERS_SHORT } from "../_shared/cors.ts";
import {
  DEFAULT_PROVIDER_ORDER,
  getConfiguredApiKeys,
  tryExternalProvider,
  tryLovableAI,
  type AIResult,
} from "../_shared/ai-providers.ts";
import { checkAIPlanLimit } from "../_shared/ai-plan-limits.ts";

const CLINICAL_CASE_SEPARATOR = "|||AFIRMACAO|||";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, CORS_HEADERS_SHORT);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { quiz_id, only_missing = true, target = "irat" } = await req.json();
    if (!quiz_id) {
      return new Response(JSON.stringify({ error: "quiz_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Ownership check
    const { data: quiz } = await admin.from("quizzes").select("id, teacher_id, title").eq("id", quiz_id).maybeSingle();
    if (!quiz || quiz.teacher_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const planCheck = await checkAIPlanLimit(admin, user.id, user.email!);
    if (planCheck.blocked) {
      return new Response(JSON.stringify(planCheck.body), {
        status: planCheck.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isApplication = target === "application";
    const table = isApplication ? "application_questions" : "questions";
    const correctCol = isApplication ? "correct_answer" : "correct_option";

    const selectCols = isApplication
      ? "id, question_text, correct_answer, explanation"
      : "id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation";

    const { data: allQs } = await admin.from(table)
      .select(selectCols)
      .eq("quiz_id", quiz_id)
      .is("deleted_at", null);

    const questions = (allQs || []).filter((q: any) =>
      only_missing ? !q.explanation || !String(q.explanation).trim() : true
    );

    if (questions.length === 0) {
      return new Response(JSON.stringify({ updated: 0, message: "Nenhuma questão pendente." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt: string;
    let userPrompt: string;

    if (isApplication) {
      systemPrompt = `Você é um professor especialista. Para cada afirmação (Verdadeiro/Falso) baseada em um caso clínico, gere uma explicação técnica e didática (3-6 frases) que:
1) Justifique por que a resposta correta (Verdadeiro ou Falso) é a correta;
2) Esclareça o conceito clínico subjacente e possíveis confusões comuns.
Use linguagem clara, objetiva e técnica. Retorne APENAS um JSON válido no formato:
{"explanations":[{"id":"<id>","explanation":"<texto>"}]}`;

      userPrompt = JSON.stringify(questions.map((q: any) => {
        const txt = q.question_text || "";
        const idx = txt.indexOf(CLINICAL_CASE_SEPARATOR);
        const caso = idx >= 0 ? txt.slice(0, idx).trim() : "";
        const afirm = idx >= 0 ? txt.slice(idx + CLINICAL_CASE_SEPARATOR.length).trim() : txt;
        return {
          id: q.id,
          caso_clinico: caso,
          afirmacao: afirm,
          correta: (q.correct_answer || "").trim() === "V" ? "Verdadeiro" : "Falso",
        };
      }));
    } else {
      systemPrompt = `Você é um professor especialista. Para cada questão de múltipla escolha, gere uma explicação técnica e didática (3-6 frases) que:
1) Justifique por que a alternativa CORRETA está certa;
2) Explique brevemente por que cada uma das demais alternativas está incorreta.
Use linguagem clara, objetiva e técnica. Retorne APENAS um JSON válido no formato:
{"explanations":[{"id":"<id>","explanation":"<texto>"}]}`;

      userPrompt = JSON.stringify(questions.map((q: any) => ({
        id: q.id,
        enunciado: q.question_text,
        A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d,
        correta: q.correct_option,
      })));
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // Try the teacher's configured external providers first; only fall back
    // to the Lovable AI gateway (platform default) if none are configured or
    // all of them fail.
    let aiResult: AIResult | null = null;

    try {
      const apiKeys = await getConfiguredApiKeys(admin);
      if (apiKeys.length > 0) {
        for (const providerName of DEFAULT_PROVIDER_ORDER) {
          const keyRow = apiKeys.find((k) => k.provider === providerName);
          if (!keyRow) continue;

          aiResult = await tryExternalProvider(providerName, keyRow.api_key, messages, { jsonMode: true });
          if (aiResult) break;
        }
      }
    } catch (e) {
      console.error("[EXPLANATIONS] Error fetching external keys, falling back:", e);
    }

    if (!aiResult) {
      try {
        aiResult = await tryLovableAI(messages, { jsonMode: true });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: "AI error", detail: e?.message || String(e) }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const result = aiResult!;

    let parsed: any;
    try { parsed = JSON.parse(result.content || "{}"); } catch { parsed = {}; }
    const arr: { id: string; explanation: string }[] = parsed.explanations || [];

    let updated = 0;
    for (const item of arr) {
      if (!item.id || !item.explanation) continue;
      const { error } = await admin.from(table)
        .update({ explanation: item.explanation })
        .eq("id", item.id)
        .eq("quiz_id", quiz_id);
      if (!error) updated++;
    }

    try {
      await admin.from("ai_usage_log").insert({
        user_id: user.id,
        provider: result.provider,
        model: result.model,
        tokens_input: result.tokensInput,
        tokens_output: result.tokensOutput,
        tokens_used: result.tokensInput + result.tokensOutput,
        prompt_type: isApplication ? "explanations_application" : "explanations",
      });
    } catch (_) {}

    return new Response(JSON.stringify({ updated, total: questions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

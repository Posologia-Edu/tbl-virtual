import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface QIn {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { quiz_id, only_missing = true } = await req.json();
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

    let query = admin.from("questions")
      .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation")
      .eq("quiz_id", quiz_id)
      .is("deleted_at", null);
    const { data: allQs } = await query;
    const questions: QIn[] = (allQs || []).filter((q: any) =>
      only_missing ? !q.explanation || !q.explanation.trim() : true
    );

    if (questions.length === 0) {
      return new Response(JSON.stringify({ updated: 0, message: "Nenhuma questão pendente." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um professor especialista. Para cada questão de múltipla escolha, gere uma explicação técnica e didática (3-6 frases) que:
1) Justifique por que a alternativa CORRETA está certa;
2) Explique brevemente por que cada uma das demais alternativas está incorreta.
Use linguagem clara, objetiva e técnica. Retorne APENAS um JSON válido no formato:
{"explanations":[{"id":"<id>","explanation":"<texto>"}]}`;

    const userPrompt = JSON.stringify(questions.map(q => ({
      id: q.id,
      enunciado: q.question_text,
      A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d,
      correta: q.correct_option,
    })));

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI error", detail: txt }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const arr: { id: string; explanation: string }[] = parsed.explanations || [];

    let updated = 0;
    for (const item of arr) {
      if (!item.id || !item.explanation) continue;
      const { error } = await admin.from("questions")
        .update({ explanation: item.explanation })
        .eq("id", item.id)
        .eq("quiz_id", quiz_id);
      if (!error) updated++;
    }

    // Log usage (best-effort)
    try {
      const usage = aiData.usage || {};
      await admin.from("ai_usage_log").insert({
        user_id: user.id,
        provider: "lovable",
        model: "google/gemini-2.5-flash",
        tokens_input: usage.prompt_tokens || 0,
        tokens_output: usage.completion_tokens || 0,
        tokens_used: usage.total_tokens || 0,
        prompt_type: "explanations",
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

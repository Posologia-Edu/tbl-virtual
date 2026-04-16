import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

async function extractPdfText(base64: string): Promise<string> {
  const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const pdf = await getDocumentProxy(binary);
  const { text } = await extractText(pdf, { mergePages: true });
  const cleaned = (Array.isArray(text) ? text.join("\n") : text).trim();
  return cleaned.slice(0, 35000);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_AI_LIMITS: Record<string, number> = {
  "prod_U1oaoU5nQAqqW3": 0,
  "prod_U1oaz7iVie1pFU": 50,
  "prod_U1ob8n7iDfyGLT": Infinity,
  admin: Infinity,
};

const PROVIDER_CONFIGS: Record<string, { url: string; model: string; mapBody?: (body: any) => any }> = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    model: "claude-sonnet-4-20250514",
    mapBody: (body: any) => ({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: body.messages.find((m: any) => m.role === "system")?.content || "",
      messages: body.messages.filter((m: any) => m.role !== "system"),
    }),
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "google/gemini-2.5-flash",
  },
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.5-flash",
  },
};

interface AIResult {
  content: string;
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
}

// Cost per 1M tokens (input/output) in USD
const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "gemini-2.5-flash": { input: 0.15, output: 0.60 },
  "google/gemini-2.5-flash": { input: 0.15, output: 0.60 },
};

function estimateCost(model: string, tokensInput: number, tokensOutput: number): number {
  const costs = TOKEN_COSTS[model] || { input: 0.15, output: 0.60 };
  return (tokensInput * costs.input + tokensOutput * costs.output) / 1_000_000;
}


function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(`TIMEOUT:${label}`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("PROVIDER_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseGeneratedQuestions(rawContent: string) {
  const trimmed = rawContent.trim();
  const candidates = [trimmed];

  if (trimmed.startsWith("```")) {
    candidates.push(trimmed.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim());
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed?.irat_questions) && Array.isArray(parsed?.application_questions)) {
        return parsed;
      }
    } catch {
      // ignore and try next candidate
    }
  }

  throw new Error("INVALID_AI_JSON");
}

async function tryExternalProvider(
  provider: string,
  apiKey: string,
  messages: any[]
): Promise<AIResult | null> {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) return null;

  try {
    const baseBody = { model: config.model, messages };
    const isAnthropic = provider === "anthropic";

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isAnthropic) {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    let url = config.url;
    if (provider === "google") {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const body = config.mapBody ? config.mapBody(baseBody) : baseBody;

    console.log(`[AI] Trying provider: ${provider}`);
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }, 25000);

    if (!res.ok) {
      const t = await res.text();
      console.error(`[AI] ${provider} failed (${res.status}): ${t}`);
      return null;
    }

    const data = await res.json();

    let content: string | null = null;
    let tokensInput = 0;
    let tokensOutput = 0;

    if (isAnthropic) {
      content = data.content?.[0]?.text || null;
      tokensInput = data.usage?.input_tokens ?? 0;
      tokensOutput = data.usage?.output_tokens ?? 0;
    } else {
      content = data.choices?.[0]?.message?.content || null;
      tokensInput = data.usage?.prompt_tokens ?? 0;
      tokensOutput = data.usage?.completion_tokens ?? 0;
    }

    if (!content) return null;

    return { content, provider, model: config.model, tokensInput, tokensOutput };
  } catch (e) {
    console.error(`[AI] ${provider} error:`, e);
    return null;
  }
}

async function tryLovableAI(messages: any[]): Promise<AIResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const model = "google/gemini-2.5-flash";
  console.log("[AI] Using Lovable AI (fallback)");
  const response = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  }, 25000);

  if (!response.ok) {
    const t = await response.text();
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("PAYMENT_REQUIRED");
    if (t.includes("context length") || t.includes("too many tokens")) throw new Error("CONTEXT_TOO_LARGE");
    throw new Error(`Lovable AI error ${response.status}: ${t}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const tokensInput = data.usage?.prompt_tokens ?? 0;
  const tokensOutput = data.usage?.completion_tokens ?? 0;

  return { content, provider: "lovable", model, tokensInput, tokensOutput };
}

async function getUserPlanLimit(supabaseClient: any, userId: string, userEmail: string): Promise<{ limit: number; used: number; productId: string | null }> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count: used } = await supabaseClient
    .from("ai_usage_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("used_at", firstOfMonth);

  const { data: isAdmin } = await supabaseClient.rpc("is_admin", { _user_id: userId });
  if (isAdmin) {
    return { limit: Infinity, used: used || 0, productId: "admin" };
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  let productId: string | null = null;

  if (stripeKey) {
    try {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) {
        const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 1 });
        if (subs.data.length > 0) {
          productId = subs.data[0].items.data[0].price.product as string;
        }
      }
    } catch (e) {
      console.error("[AI] Stripe check failed:", e);
    }
  }

  if (!productId) {
    const { data: manualSub } = await supabaseClient
      .from("manual_subscriptions")
      .select("plan, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (manualSub && manualSub.plan !== "free") {
      const isExpired = manualSub.expires_at && new Date(manualSub.expires_at) < now;
      if (!isExpired) {
        const planToProduct: Record<string, string> = {
          pro: "prod_U1oaz7iVie1pFU",
          institutional: "prod_U1ob8n7iDfyGLT",
        };
        productId = planToProduct[manualSub.plan] || null;
      }
    }
  }

  if (!productId) productId = "prod_U1oaoU5nQAqqW3";
  const limit = PLAN_AI_LIMITS[productId] ?? 0;
  return { limit, used: used || 0, productId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Não autorizado");
    const user = userData.user;

    const { limit, used } = await getUserPlanLimit(adminClient, user.id, user.email!);
    console.log(`[AI] User ${user.email} plan limit: ${limit}, used: ${used}`);

    if (limit === 0) {
      return new Response(JSON.stringify({
        error: "PLAN_LIMIT",
        message: "Seu plano atual não inclui geração de questões com IA. Faça upgrade para o plano Pro ou Institucional.",
        used, limit,
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (isFinite(limit) && used >= limit) {
      return new Response(JSON.stringify({
        error: "PLAN_LIMIT",
        message: `Você atingiu o limite de ${limit} gerações de IA este mês (${used}/${limit}). Faça upgrade para continuar.`,
        used, limit,
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { fileContent, fileName, mimeType } = await req.json();

    if (!fileContent) {
      return new Response(JSON.stringify({ error: "No file content provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um especialista em educação médica e TBL (Team-Based Learning). 
Sua tarefa é analisar o material de apoio fornecido e criar questões baseadas EXCLUSIVAMENTE no conteúdo do material.

NUNCA invente informações que não estejam no material fornecido.

Você deve gerar EXATAMENTE:

1. **10 questões de iRAT/tRAT**: Cada uma com 4 alternativas (A, B, C, D), sendo apenas uma correta. As questões devem testar compreensão e aplicação dos conceitos do material.

2. **3 casos clínicos de aplicação**: Cada caso deve ser um cenário clínico detalhado e contextualizado baseado no material, com uma afirmação que o aluno deve julgar como Verdadeiro (V) ou Falso (F).

Responda EXCLUSIVAMENTE no formato JSON abaixo, sem nenhum texto adicional:

{
  "irat_questions": [
    {
      "question_text": "Enunciado da questão",
      "option_a": "Alternativa A",
      "option_b": "Alternativa B", 
      "option_c": "Alternativa C",
      "option_d": "Alternativa D",
      "correct_option": "A"
    }
  ],
  "application_questions": [
    {
      "question_text": "Caso clínico detalhado com afirmação para julgar V ou F",
      "correct_answer": "V"
    }
  ]
}`;

    const isPdf = mimeType === 'application/pdf';
    const isTextContent = !mimeType || mimeType === 'text/plain' || isPdf;

    let processedTextContent = fileContent;
    if (isPdf) {
      try {
        console.log(`[AI] Extracting text from PDF: ${fileName}`);
        processedTextContent = await withTimeout(extractPdfText(fileContent), 15000, "PDF_EXTRACT");
        console.log(`[AI] Extracted ${processedTextContent.length} chars from PDF`);
        if (!processedTextContent || processedTextContent.length < 50) {
          return new Response(JSON.stringify({ error: "Não foi possível extrair texto do PDF. O arquivo pode ser uma imagem escaneada. Tente converter para texto antes." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e: any) {
        console.error("[AI] PDF extraction failed:", e);
        return new Response(JSON.stringify({ error: `Erro ao processar PDF: ${e.message}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let userContent: any;
    if (isTextContent) {
      userContent = `Analise o seguinte material de apoio (arquivo: ${fileName}) e crie as questões conforme instruído:\n\n${processedTextContent}`;
    } else {
      userContent = [
        { type: "text", text: `Analise o material de apoio anexado (arquivo: ${fileName}) e crie as questões conforme instruído.` },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileContent}` } },
      ];
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ];

    // Try external providers first
    let aiResult: AIResult | null = null;

    try {
      const { data: apiKeys } = await adminClient.from("ai_api_keys").select("provider, api_key");
      console.log(`[AI] Configured providers: ${apiKeys?.map((k: any) => k.provider).join(",") || "none"}`);

      if (apiKeys && apiKeys.length > 0) {
        const preferredOrder = ["google", "openai", "groq", "openrouter", "anthropic"];

        for (const providerName of preferredOrder) {
          console.log(`[AI] Evaluating provider: ${providerName}`);
          const keyRow = apiKeys.find((k: any) => k.provider === providerName);
          if (!keyRow) continue;

          if (!isTextContent && (providerName === "groq" || providerName === "anthropic")) continue;

          aiResult = await tryExternalProvider(providerName, keyRow.api_key, messages);
          if (aiResult) {
            console.log(`[AI] Success with provider: ${providerName}`);
            break;
          }
        }
      }
    } catch (e) {
      console.error("[AI] Error fetching external keys, falling back:", e);
    }

    // Fallback to Lovable AI
    if (!aiResult) {
      try {
        aiResult = await tryLovableAI(messages);
      } catch (e: any) {
        if (e.message === "RATE_LIMIT") {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (e.message === "PAYMENT_REQUIRED") {
          return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (e.message === "CONTEXT_TOO_LARGE") {
          return new Response(JSON.stringify({ error: "O arquivo é muito grande. Tente com um arquivo menor (máximo ~50 páginas)." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (e.message === "PROVIDER_TIMEOUT") {
          return new Response(JSON.stringify({ error: "A IA demorou demais para responder. Tente novamente com um PDF menor ou mais objetivo." }), {
            status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw e;
      }
    }

    if (!aiResult?.content) {
      return new Response(JSON.stringify({ error: "IA não retornou conteúdo" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log AI usage with detailed data
    const cost = estimateCost(aiResult.model, aiResult.tokensInput, aiResult.tokensOutput);
    await adminClient.from("ai_usage_log").insert({
      user_id: user.id,
      provider: aiResult.provider,
      model: aiResult.model,
      prompt_type: "quiz_generation",
      tokens_input: aiResult.tokensInput,
      tokens_output: aiResult.tokensOutput,
      tokens_used: aiResult.tokensInput + aiResult.tokensOutput,
      estimated_cost_usd: cost,
    });
    console.log(`[AI] Usage logged: ${aiResult.provider}/${aiResult.model} | ${aiResult.tokensInput}+${aiResult.tokensOutput} tokens | $${cost.toFixed(6)}`);

    const questions = parseGeneratedQuestions(aiResult.content);

    return new Response(JSON.stringify(questions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-quiz-ai error:", e);
    const message = e instanceof Error ? e.message : "Erro desconhecido";

    if (message === "INVALID_AI_JSON") {
      return new Response(JSON.stringify({ error: "A IA retornou um formato inválido. Tente novamente." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (message.startsWith("TIMEOUT:PDF_EXTRACT")) {
      return new Response(JSON.stringify({ error: "O PDF demorou demais para ser processado. Tente um arquivo menor ou com menos páginas." }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (message === "PROVIDER_TIMEOUT") {
      return new Response(JSON.stringify({ error: "A IA demorou demais para responder. Tente novamente com um PDF menor ou em texto pesquisável." }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
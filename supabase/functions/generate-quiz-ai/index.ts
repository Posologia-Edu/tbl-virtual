import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

async function getConfiguredApiKeys(supabaseClient: any) {
  const { data, error } = await supabaseClient.from("ai_api_keys").select("provider, api_key");
  if (error) throw error;
  return data ?? [];
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

    const body = await req.json();
    // Support both single-file (legacy) and multi-file payloads
    type IncomingFile = { fileContent: string; fileName: string; mimeType?: string };
    const files: IncomingFile[] = Array.isArray(body?.files) && body.files.length > 0
      ? body.files
      : (body?.fileContent ? [{ fileContent: body.fileContent, fileName: body.fileName, mimeType: body.mimeType }] : []);

    if (files.length === 0) {
      return new Response(JSON.stringify({ error: "No file content provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body?.mode === "extract_text") {
      if (files.length !== 1) {
        return new Response(JSON.stringify({ error: "Envie apenas um arquivo por extração de texto." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const file = files[0];
      if (file.mimeType !== "application/pdf") {
        return new Response(JSON.stringify({ files }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        console.log(`[AI] Extracting text from single PDF: ${file.fileName}`);
        const text = await withTimeout(extractPdfText(file.fileContent), 15000, "PDF_EXTRACT");
        console.log(`[AI] Extracted ${text.length} chars from single PDF ${file.fileName}`);
        if (!text || text.length < 50) {
          return new Response(JSON.stringify({ error: `Não foi possível extrair texto do PDF "${file.fileName}". O arquivo pode ser uma imagem escaneada. Tente converter para texto antes.` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ files: [{ fileContent: text, fileName: file.fileName }] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        console.error("[AI] Single PDF extraction failed:", e);
        const errorMessage = getErrorMessage(e);
        const message = errorMessage === "TIMEOUT:PDF_EXTRACT"
          ? `O PDF "${file.fileName}" demorou demais para ser processado. Tente um arquivo menor ou com menos páginas.`
          : `Erro ao processar PDF "${file.fileName}": ${errorMessage}`;
        const status = errorMessage === "TIMEOUT:PDF_EXTRACT" ? 504 : 400;
        return new Response(JSON.stringify({ error: message }), {
          status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const systemPrompt = `Você é um especialista em educação médica e TBL (Team-Based Learning). 
Sua tarefa é analisar o material de apoio fornecido e criar questões baseadas EXCLUSIVAMENTE no conteúdo do material.

NUNCA invente informações que não estejam no material fornecido.

Você deve gerar EXATAMENTE:

1. **10 questões de iRAT/tRAT** (4 alternativas A, B, C, D, apenas uma correta), distribuídas RIGOROSAMENTE por nível de dificuldade cognitiva (taxonomia de Bloom):
   - **2 questões FÁCEIS (25% → 2 de 10... use exatamente 2)**: nível de "lembrar/compreender". Resposta direta, recuperação de fatos, definições ou conceitos explícitos no material. Aluno que apenas leu o material consegue responder.
   - **5 questões MEDIANAS (50%)**: nível de "aplicar/analisar". Exigem compreensão consolidada e raciocínio para aplicar conceitos a situações concretas. Quem estudou o material responde, mas exige carga cognitiva relevante (não é apenas leitura superficial).
   - **3 questões DIFÍCEIS (25%)**: nível de "avaliar/criar". Exigem integração de múltiplos conceitos, distinção fina entre alternativas plausíveis, raciocínio clínico ou inferências não explícitas no texto. Distratores devem ser fortes e parecer corretos à primeira vista.
   Importante: distribua os níveis ao longo das 10 questões (não agrupe por dificuldade) e NÃO mencione o nível de dificuldade dentro do enunciado.

2. **3 casos clínicos de aplicação (tRAT em equipe)** — devem seguir RIGOROSAMENTE o padrão de questões de **provas de concurso público de alto nível e residência médica** (estilo Revalida, USP, UNIFESP, UFRJ, UNICAMP, AMRIGS, ENARE, INEP, FCC, CESPE/Cebraspe). NÃO gere casos curtos ou simplistas como "Paciente de 10 anos com asma leve...". Cada caso clínico DEVE conter, no mínimo:
   - **Identificação completa**: idade, sexo, profissão/ocupação quando relevante, procedência.
   - **Queixa principal e HDA detalhada**: tempo de evolução, caracterização dos sintomas, fatores de melhora/piora, sintomas associados, uso prévio de medicações com doses e tempo de uso.
   - **Antecedentes pessoais e familiares relevantes**: comorbidades, alergias, cirurgias, medicações em uso (com posologia), hábitos de vida (tabagismo, etilismo), histórico familiar pertinente.
   - **Exame físico objetivo**: sinais vitais COMPLETOS (PA, FC, FR, Tax, SatO₂), dados antropométricos (peso, altura, IMC) quando pertinente, achados segmentares relevantes (ausculta, palpação, inspeção).
   - **Exames complementares com valores numéricos**: hemograma, bioquímica, gasometria, ECG, imagens, espirometria etc., conforme o tema. Inclua valores de referência implícitos (números realistas).
   - **Conduta já instituída ou contexto terapêutico** quando aplicável.
   - **Extensão mínima**: cada caso clínico deve ter entre 120 e 220 palavras de contexto ANTES da afirmação a julgar.
   - **Afirmação final (V ou F)**: deve exigir integração de múltiplos conceitos, raciocínio fisiopatológico, farmacológico ou diagnóstico diferencial — NUNCA mera recuperação de informação. A afirmação pode envolver: escolha terapêutica de primeira linha vs. alternativa, ajuste de dose, contraindicação relativa/absoluta, interpretação de exame, prognóstico, mecanismo de ação, interação medicamentosa, classificação de gravidade segundo diretriz citada.
   - Os 3 casos devem abordar **temas e cenários distintos** entre si (variar gravidade, faixa etária, contexto clínico).
   - Use linguagem técnica formal de prova médica. NÃO use frases simples do tipo "É correto iniciar...?" — prefira construções típicas de prova: "Diante do quadro descrito, a conduta mais adequada é a introdução de X na dose Y.", "A hipótese diagnóstica mais provável justifica a suspensão imediata de Z.", etc.
   - Todos os dados clínicos e a resposta correta DEVEM derivar do material fornecido (não invente diretrizes).

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

    // Process each uploaded file: extract text from PDFs, keep base64 for images.
    type ProcessedFile = {
      fileName: string;
      mimeType?: string;
      isTextContent: boolean;
      textContent?: string;
      base64?: string;
    };
    const processedFiles: ProcessedFile[] = [];

    for (const f of files) {
      const fIsPdf = f.mimeType === 'application/pdf';
      const fIsTextContent = !f.mimeType || f.mimeType === 'text/plain' || fIsPdf;

      if (fIsPdf) {
        try {
          console.log(`[AI] Extracting text from PDF: ${f.fileName}`);
          const text = await withTimeout(extractPdfText(f.fileContent), 15000, "PDF_EXTRACT");
          console.log(`[AI] Extracted ${text.length} chars from PDF ${f.fileName}`);
          if (!text || text.length < 50) {
            return new Response(JSON.stringify({ error: `Não foi possível extrair texto do PDF "${f.fileName}". O arquivo pode ser uma imagem escaneada. Tente converter para texto antes.` }), {
              status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          processedFiles.push({ fileName: f.fileName, mimeType: f.mimeType, isTextContent: true, textContent: text });
        } catch (e: any) {
          console.error("[AI] PDF extraction failed:", e);
          const errorMessage = getErrorMessage(e);
          const message = errorMessage === "TIMEOUT:PDF_EXTRACT"
            ? `O PDF "${f.fileName}" demorou demais para ser processado. Tente um arquivo menor ou com menos páginas.`
            : `Erro ao processar PDF "${f.fileName}": ${errorMessage}`;
          const status = errorMessage === "TIMEOUT:PDF_EXTRACT" ? 504 : 400;
          return new Response(JSON.stringify({ error: message }), {
            status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (fIsTextContent) {
        processedFiles.push({ fileName: f.fileName, mimeType: f.mimeType, isTextContent: true, textContent: f.fileContent });
      } else {
        processedFiles.push({ fileName: f.fileName, mimeType: f.mimeType, isTextContent: false, base64: f.fileContent });
      }
    }

    const allText = processedFiles.every(p => p.isTextContent);
    let userContent: any;
    if (allText) {
      const concatenated = processedFiles
        .map((p, idx) => `===== MATERIAL ${idx + 1}: ${p.fileName} =====\n\n${p.textContent}`)
        .join('\n\n');
      const namesList = processedFiles.map(p => p.fileName).join(', ');
      userContent = `Analise os seguintes ${processedFiles.length} material(is) de apoio (arquivos: ${namesList}) de forma INTEGRADA e crie as questões conforme instruído. As questões devem cobrir o conteúdo combinado de TODOS os materiais.\n\n${concatenated}`;
    } else {
      const parts: any[] = [
        { type: "text", text: `Analise os ${processedFiles.length} material(is) de apoio anexado(s) (${processedFiles.map(p => p.fileName).join(', ')}) de forma INTEGRADA e crie as questões conforme instruído. As questões devem cobrir o conteúdo combinado de TODOS os materiais.` },
      ];
      for (const p of processedFiles) {
        if (p.isTextContent) {
          parts.push({ type: "text", text: `\n===== MATERIAL: ${p.fileName} =====\n\n${p.textContent}` });
        } else {
          parts.push({ type: "image_url", image_url: { url: `data:${p.mimeType};base64,${p.base64}` } });
        }
      }
      userContent = parts;
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ];

    // Try external providers first
    let aiResult: AIResult | null = null;

    try {
      const apiKeys = await getConfiguredApiKeys(adminClient);
      console.log(`[AI] Configured providers: ${apiKeys?.map((k: any) => k.provider).join(",") || "none"}`);

      if (apiKeys && apiKeys.length > 0) {
        const preferredOrder = ["google", "openai", "groq", "openrouter", "anthropic"];

        for (const providerName of preferredOrder) {
          console.log(`[AI] Evaluating provider: ${providerName}`);
          const keyRow = apiKeys.find((k: any) => k.provider === providerName);
          if (!keyRow) continue;

          if (!allText && (providerName === "groq" || providerName === "anthropic")) continue;

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
        const errorMessage = getErrorMessage(e);
        if (errorMessage === "RATE_LIMIT") {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (errorMessage === "PAYMENT_REQUIRED") {
          return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (errorMessage === "CONTEXT_TOO_LARGE") {
          return new Response(JSON.stringify({ error: "O arquivo é muito grande. Tente com um arquivo menor (máximo ~50 páginas)." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (errorMessage === "PROVIDER_TIMEOUT") {
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
    const message = getErrorMessage(e) || "Erro desconhecido";

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
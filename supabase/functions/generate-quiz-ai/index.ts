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

    const systemPrompt = `Você é uma banca examinadora médica de alto nível, especializada em TBL (Team-Based Learning), residência médica e concursos públicos.
Sua tarefa é analisar o material de apoio fornecido e criar questões baseadas EXCLUSIVAMENTE no conteúdo do material.

NUNCA invente diretrizes, condutas ou dados que contradigam o material fornecido.

Você deve gerar EXATAMENTE:

1. **10 questões de iRAT/tRAT** (4 alternativas A, B, C, D, apenas uma correta). O iRAT serve para verificar se o aluno ESTUDOU o material com PROFUNDIDADE — exige memorização e compreensão sólidas, NÃO mero raciocínio dedutivo a partir do enunciado. Distribua por dificuldade cognitiva:
   - **2 questões FÁCEIS**: lembrar/compreender conceito específico do material (mas NUNCA óbvias — ver regras abaixo).
   - **5 questões MEDIANAS**: compreender em profundidade — mecanismos, classificações, critérios diagnósticos, doses, interações, contraindicações específicas.
   - **3 questões DIFÍCEIS**: distinção fina entre conceitos próximos, detalhes técnicos que só quem estudou a fundo sabe (ex.: subtipos receptores, valores de corte, nomes de escalas, exceções a regras).
   Distribua os níveis ao longo das 10 questões e NÃO mencione o nível no enunciado.

REGRAS ANTI-ÓBVIO (CRÍTICAS) PARA O iRAT:
- **PROIBIDO** que o enunciado contenha a resposta de forma literal ou semântica. Exemplo PROIBIDO: "Qual o papel dos antagonistas de leucotrienos?" com resposta "Inibição da produção de leucotrienos" — a palavra-chave da resposta já está no enunciado.
- **PROIBIDO** perguntas de definição tautológica ("O que é X?" → "É o que faz X"). Reformule para exigir conhecimento específico: dose, mecanismo molecular preciso, indicação restrita, efeito adverso característico, contraindicação, valor laboratorial de referência, critério diagnóstico, classificação, sequência de etapas, etc.
- **PROIBIDO** que a resposta correta seja deduzível por eliminação trivial, por afinidade etimológica com o enunciado, ou por ser a "única tecnicamente plausível". As 4 alternativas devem ser TODAS plausíveis para quem NÃO estudou o material.
- **OBRIGATÓRIO**: as 3 alternativas erradas (distratores) devem ser conceitos REAIS e VEROSSÍMEIS do mesmo domínio (ex.: outras classes farmacológicas usadas na mesma doença, outros mecanismos de ação reais, valores próximos mas incorretos, condutas alternativas defensáveis em cenários parecidos). NUNCA distratores absurdos ou não relacionados.
- **OBRIGATÓRIO**: o enunciado deve testar um FATO específico que precisa ter sido estudado — não algo que se infere pelo nome do fármaco/conceito. Prefira perguntar "qual o mecanismo molecular", "qual o efeito adverso mais comum", "qual a dose inicial recomendada", "qual o critério diagnóstico segundo [diretriz]", "qual a contraindicação absoluta", em vez de "qual o papel de X".
- Antes de finalizar cada questão do iRAT, faça uma checagem: "Um aluno que NÃO leu o material conseguiria acertar apenas lendo o enunciado e as alternativas?". Se sim, REESCREVA a questão.

2. **EXATAMENTE 3 questões de aplicação (V/F) baseadas em UM ÚNICO caso clínico compartilhado** — padrão de prova de residência médica/concurso público de alto nível (USP, UNIFESP, UNICAMP, UFRJ, AMRIGS, ENARE, Revalida, INEP, FCC, Cebraspe).

REGRAS OBRIGATÓRIAS PARA O CASO CLÍNICO COMPARTILHADO:
- Gere **UM ÚNICO caso clínico** rico, denso e tecnicamente sofisticado que sirva de base para as **3 afirmações V/F**.
- O caso deve ter **180 a 320 palavras**, com narrativa fluida em parágrafos (não em bullets).
- Use linguagem técnica de banca: terminologia médica/farmacológica precisa, sinais e sintomas descritos com propriedade, dados quantitativos plausíveis.
- O caso deve conter, de forma natural no texto, conforme o tema permitir:
  1) identificação: idade, sexo, contexto/procedência, ocupação;
  2) queixa principal e HDA com tempo de evolução, evolução temporal, fatores desencadeantes/atenuantes, sintomas associados, resposta a tratamentos prévios;
  3) antecedentes pessoais e familiares, comorbidades, alergias, medicações em uso com dose/posologia, hábitos;
  4) exame físico objetivo com sinais vitais (PA, FC, FR, T, SatO₂) e achados segmentares;
  5) pelo menos **dois dados complementares numéricos** quando aplicável (espirometria/VEF1/CVF, gasometria, hemograma, IgE/eosinófilos, ECG, creatinina, glicemia, escalas validadas, etc.).
- Inspire-se no padrão deste exemplo real de banca (estilo, densidade, riqueza de detalhes psicopatológicos/clínicos):
"Homem, 21 anos, estudante universitário, refere estar ansioso, angustiado, desanimado e com insônia inicial há 2 meses, em razão de sentimentos de estranheza com relação ao mundo, percebe o clima ao seu redor como ameaçador e tem a sensação de que alguma coisa está para acontecer, que 'não há escapatória'... Na segunda consulta psiquiátrica, após 4 meses do primeiro atendimento, relata que os professores estão perseguindo, realizam reuniões para difamá-lo e estão criando estratégias para reprová-lo... O paciente conclui sua fala, dizendo: 'Lembro-me de que, quando eu era criança, ganhei uma Bíblia do meu professor de religião. Por isso, os professores estão me perseguindo'."

REGRAS OBRIGATÓRIAS PARA AS 3 AFIRMAÇÕES V/F:
- As **3 afirmações compartilham o MESMO caso** (como questões 01, 02, 03 numa prova).
- Cada afirmação deve abordar um aspecto DIFERENTE do caso: por exemplo, (a) diagnóstico/classificação/psicopatologia, (b) conduta terapêutica/farmacológica/contraindicação, (c) interpretação de dado/mecanismo/diagnóstico diferencial/prognóstico.
- Cada afirmação deve exigir raciocínio clínico-farmacológico, NÃO pura memorização.
- Misture afirmações verdadeiras e falsas (não as três iguais). As falsas devem ter erro técnico defensável a partir do material.
- A resposta correta deve ser inequivocamente defensável pelo material fornecido.

FORMATO OBRIGATÓRIO PARA AS 3 QUESTÕES DE APLICAÇÃO (CRÍTICO):
- As 3 questões compartilham o MESMO caso clínico. O caso deve aparecer integralmente em TODAS as 3 questões (o aluno responde cada afirmação separadamente e precisa ver o caso em cada tela).
- Use EXATAMENTE o separador literal "|||AFIRMACAO|||" entre o caso clínico e a afirmação V/F. Não traduza, não altere, não adicione espaços ao separador.
- Formato de cada question_text (texto puro, SEM asteriscos, SEM markdown):
  "[texto integral do caso clínico, 180-320 palavras, em parágrafos]|||AFIRMACAO|||[afirmação específica desta questão, sem prefixo 'Afirmação X:', apenas a afirmação a ser julgada como V ou F]"
- O TEXTO DO CASO CLÍNICO deve ser IDÊNTICO nas 3 questões (mesmo conteúdo, mesma pontuação, mesmas quebras de linha). Apenas a parte após "|||AFIRMACAO|||" muda.
- NÃO inclua "CASO CLÍNICO:", "Afirmação 1:", "Julgue como Verdadeiro ou Falso", nem qualquer rótulo — o sistema renderiza isso automaticamente.
- NÃO use asteriscos (**), markdown ou formatação. Apenas texto puro com quebras de linha (\\n) dentro do caso quando necessário.
- Em "correct_answer", use apenas "V" ou "F".

PROIBIDO:
- Omitir o caso clínico nas questões 2 e 3 (o caso DEVE estar nas 3, idêntico).
- Gerar 3 casos clínicos diferentes (deve ser 1 caso, repetido literalmente).
- Esquecer ou alterar o separador "|||AFIRMACAO|||".
- Usar asteriscos, markdown, rótulos como "Afirmação X:" ou "CASO CLÍNICO:".
- Caso genérico tipo "Paciente de 30 anos com asma leve...".
- Caso com menos de 180 palavras.
- Afirmações que sejam simples reformulação direta do enunciado sem exigir raciocínio.
- Repetir o mesmo aspecto nas 3 afirmações.

Antes de responder, faça uma checagem interna: o caso tem densidade de banca? As 3 afirmações cobrem aspectos distintos? O caso é IDÊNTICO nas 3 questões? O separador "|||AFIRMACAO|||" está em todas? Não há asteriscos nem rótulos? Se não, reescreva.

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
      "question_text": "[CASO CLÍNICO INTEGRAL — 180-320 palavras]|||AFIRMACAO|||[afirmação 1, sem rótulo]",
      "correct_answer": "V"
    },
    {
      "question_text": "[MESMO CASO CLÍNICO INTEGRAL, IDÊNTICO ao da questão 1]|||AFIRMACAO|||[afirmação 2, sem rótulo]",
      "correct_answer": "F"
    },
    {
      "question_text": "[MESMO CASO CLÍNICO INTEGRAL, IDÊNTICO ao da questão 1]|||AFIRMACAO|||[afirmação 3, sem rótulo]",
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
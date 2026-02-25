import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

async function tryExternalProvider(
  provider: string,
  apiKey: string,
  messages: any[]
): Promise<string | null> {
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
      url = `${config.url}`;
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const body = config.mapBody ? config.mapBody(baseBody) : baseBody;

    console.log(`[AI] Trying provider: ${provider}`);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error(`[AI] ${provider} failed (${res.status}): ${t}`);
      return null;
    }

    const data = await res.json();

    if (isAnthropic) {
      return data.content?.[0]?.text || null;
    }
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error(`[AI] ${provider} error:`, e);
    return null;
  }
}

async function tryLovableAI(messages: any[]): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  console.log("[AI] Using Lovable AI (fallback)");
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
    }),
  });

  if (!response.ok) {
    const t = await response.text();
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("PAYMENT_REQUIRED");
    if (t.includes("context length") || t.includes("too many tokens")) throw new Error("CONTEXT_TOO_LARGE");
    throw new Error(`Lovable AI error ${response.status}: ${t}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileContent, fileName, mimeType } = await req.json();

    if (!fileContent) {
      return new Response(JSON.stringify({ error: "No file content provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const isTextContent = !mimeType || mimeType === 'text/plain';

    let userContent: any;
    if (isTextContent) {
      userContent = `Analise o seguinte material de apoio (arquivo: ${fileName}) e crie as questões conforme instruído:\n\n${fileContent}`;
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
    let content: string | null = null;

    try {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } }
      );

      const { data: apiKeys } = await adminClient.from("ai_api_keys").select("provider, api_key");

      if (apiKeys && apiKeys.length > 0) {
        // Only try text-based providers for non-text content (multimodal may not work everywhere)
        const preferredOrder = ["groq", "openai", "google", "openrouter", "anthropic"];

        for (const providerName of preferredOrder) {
          const keyRow = apiKeys.find((k: any) => k.provider === providerName);
          if (!keyRow) continue;

          // For non-text content, skip providers that may not support multimodal well
          if (!isTextContent && (providerName === "groq" || providerName === "anthropic")) continue;

          content = await tryExternalProvider(providerName, keyRow.api_key, messages);
          if (content) {
            console.log(`[AI] Success with provider: ${providerName}`);
            break;
          }
        }
      }
    } catch (e) {
      console.error("[AI] Error fetching external keys, falling back:", e);
    }

    // Fallback to Lovable AI
    if (!content) {
      try {
        content = await tryLovableAI(messages);
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
        throw e;
      }
    }

    if (!content) {
      return new Response(JSON.stringify({ error: "IA não retornou conteúdo" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse JSON from response
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const questions = JSON.parse(jsonStr);

    return new Response(JSON.stringify(questions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-quiz-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

interface Suggestion {
  title: string;
  description: string;
  category: string;
  priority: string;
}

interface SuggestResponse {
  ok: boolean;
  count?: number;
  suggestions?: Suggestion[];
  error?: string;
  code?: string;
  provider?: string;
}

const respond = (payload: SuggestResponse) =>
  new Response(JSON.stringify(payload), { status: 200, headers: jsonHeaders });

// --- Provider configs (same pattern as generate-quiz-ai) ---

const PROVIDER_CONFIGS: Record<string, { url: string; model: string; supportsTools: boolean }> = {
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.5-flash",
    supportsTools: true,
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    supportsTools: true,
  },
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    supportsTools: true,
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "google/gemini-2.5-flash",
    supportsTools: true,
  },
};

const TOOLS_PAYLOAD = [
  {
    type: "function" as const,
    function: {
      name: "suggest_roadmap_items",
      description: "Return 5-6 new roadmap suggestions for the platform.",
      parameters: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                category: { type: "string", enum: ["feature", "improvement", "bugfix", "security", "infrastructure"] },
                priority: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["title", "description", "category", "priority"],
              additionalProperties: false,
            },
          },
        },
        required: ["suggestions"],
        additionalProperties: false,
      },
    },
  },
];

function buildPrompts(existingList: string) {
  const systemPrompt = `Você é um consultor de produto especializado em plataformas educacionais de TBL (Team-Based Learning). 
Sua tarefa é sugerir funcionalidades NOVAS e RELEVANTES para o roadmap de uma plataforma que possui:
- Sistema iRAT/tRAT com distribuição de pontos
- Questões de Aplicação com casos clínicos
- Geração de questionários por IA
- Gestão de turmas e equipes
- Dashboard do professor e do aluno
- Sistema de conquistas/gamificação
- Relatórios e analytics
- Autenticação e planos de assinatura
- Pipeline de atualizações/changelog
- Sistema de apelações
- QR Code para entrada em salas

REGRAS ABSOLUTAS:
1. NÃO sugira funcionalidades que já existam (veja a lista abaixo)
2. NÃO sugira variações mínimas de funcionalidades existentes
3. Cada sugestão deve ser genuinamente NOVA e de alto valor para professores e alunos
4. Priorize funcionalidades inovadoras que diferenciem a plataforma
5. Retorne EXATAMENTE 5 ou 6 sugestões`;

  const userPrompt = `Aqui estão TODAS as funcionalidades já existentes ou planejadas no sistema:

${existingList}

Gere 5-6 sugestões de funcionalidades COMPLETAMENTE NOVAS que NÃO estejam na lista acima. Para cada uma, retorne: title, description, category (feature|improvement|bugfix|security|infrastructure), priority (high|medium|low).`;

  return { systemPrompt, userPrompt };
}

// Parse suggestions from tool_calls or plain JSON content
function parseSuggestions(data: any): Suggestion[] | null {
  // Try tool_calls first
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall) {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      return parsed.suggestions || null;
    } catch { /* fall through */ }
  }

  // Try plain content (for providers that may not use tool_calls properly)
  const content = data.choices?.[0]?.message?.content;
  if (content) {
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      const parsed = JSON.parse(jsonStr);
      return parsed.suggestions || (Array.isArray(parsed) ? parsed : null);
    } catch { /* fall through */ }
  }

  return null;
}

async function tryExternalProvider(
  provider: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ suggestions: Suggestion[]; provider: string } | null> {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) return null;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    };

    const body: any = {
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };

    if (config.supportsTools) {
      body.tools = TOOLS_PAYLOAD;
      body.tool_choice = { type: "function", function: { name: "suggest_roadmap_items" } };
    }

    console.log(`[ROADMAP-AI] Trying provider: ${provider}`);
    const res = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error(`[ROADMAP-AI] ${provider} failed (${res.status}): ${t}`);
      return null;
    }

    const data = await res.json();
    const suggestions = parseSuggestions(data);
    if (!suggestions || suggestions.length === 0) {
      console.error(`[ROADMAP-AI] ${provider} returned no suggestions`);
      return null;
    }

    console.log(`[ROADMAP-AI] Success with provider: ${provider} (${suggestions.length} suggestions)`);
    return { suggestions, provider };
  } catch (e) {
    console.error(`[ROADMAP-AI] ${provider} error:`, e);
    return null;
  }
}

async function tryLovableAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ suggestions: Suggestion[]; provider: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  console.log("[ROADMAP-AI] Using Lovable AI (fallback)");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: TOOLS_PAYLOAD,
      tool_choice: { type: "function", function: { name: "suggest_roadmap_items" } },
    }),
  });

  if (!res.ok) {
    const status = res.status;
    if (status === 429) throw new Error("RATE_LIMIT");
    if (status === 402) throw new Error("PAYMENT_REQUIRED");
    const t = await res.text();
    throw new Error(`Lovable AI error ${status}: ${t}`);
  }

  const data = await res.json();
  const suggestions = parseSuggestions(data);
  if (!suggestions || suggestions.length === 0) {
    throw new Error("Lovable AI returned no suggestions");
  }

  return { suggestions, provider: "lovable" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ ok: false, error: "Missing authorization", code: "UNAUTHORIZED" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return respond({ ok: false, error: "Unauthorized", code: "UNAUTHORIZED" });

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) return respond({ ok: false, error: "Admin access required", code: "ADMIN_REQUIRED" });

    // Fetch existing updates
    const { data: existing } = await supabase
      .from("system_updates")
      .select("title, description, status, category");

    const existingList = (existing || [])
      .map((e: any) => `- [${e.status}] ${e.title}: ${e.description}`)
      .join("\n");

    const { systemPrompt, userPrompt } = buildPrompts(existingList);

    // --- Try external providers first (prioritize Google) ---
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let result: { suggestions: Suggestion[]; provider: string } | null = null;

    try {
      const { data: apiKeys } = await adminClient.from("ai_api_keys").select("provider, api_key");

      if (apiKeys && apiKeys.length > 0) {
        const preferredOrder = ["google", "openai", "groq", "openrouter"];

        for (const providerName of preferredOrder) {
          const keyRow = apiKeys.find((k: any) => k.provider === providerName);
          if (!keyRow) continue;

          result = await tryExternalProvider(providerName, keyRow.api_key, systemPrompt, userPrompt);
          if (result) break;
        }
      }
    } catch (e) {
      console.error("[ROADMAP-AI] Error fetching external keys, falling back:", e);
    }

    // --- Fallback to Lovable AI ---
    if (!result) {
      try {
        result = await tryLovableAI(systemPrompt, userPrompt);
      } catch (e: any) {
        if (e.message === "RATE_LIMIT") {
          return respond({ ok: false, error: "Limite de requisições excedido. Tente novamente em alguns segundos.", code: "RATE_LIMITED" });
        }
        if (e.message === "PAYMENT_REQUIRED") {
          return respond({ ok: false, error: "Créditos de IA esgotados. Adicione fundos em Settings > Workspace > Usage.", code: "INSUFFICIENT_CREDITS" });
        }
        throw e;
      }
    }

    if (!result) {
      return respond({ ok: false, error: "Nenhum provedor de IA disponível.", code: "NO_PROVIDER" });
    }

    // Filter duplicates
    const existingTitles = new Set((existing || []).map((e: any) => e.title.toLowerCase().trim()));
    const filtered = result.suggestions.filter(
      (s) => !existingTitles.has(s.title.toLowerCase().trim())
    );

    // Insert into DB
    if (filtered.length > 0) {
      const payload = filtered.map((s) => ({
        title: s.title,
        description: s.description,
        category: s.category,
        priority: s.priority,
        status: "idea",
        tags: ["ai-generated"],
      }));

      const { error: insertError } = await adminClient.from("system_updates").insert(payload);
      if (insertError) {
        console.error("Insert error:", insertError);
        return respond({ ok: false, error: "Failed to insert suggestions", code: "INSERT_FAILED" });
      }
    }

    console.log(`[ROADMAP-AI] Done: ${filtered.length} suggestions via ${result.provider}`);
    return respond({ ok: true, count: filtered.length, suggestions: filtered, provider: result.provider });
  } catch (e) {
    console.error("suggest-roadmap-ai error:", e);
    return respond({ ok: false, error: e instanceof Error ? e.message : "Unknown error", code: "UNEXPECTED_ERROR" });
  }
});

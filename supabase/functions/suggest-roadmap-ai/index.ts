import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, CORS_HEADERS_LONG } from "../_shared/cors.ts";
import { getConfiguredApiKeys, tryExternalProvider, tryLovableAI } from "../_shared/ai-providers.ts";

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

// Anthropic uses a different tool-calling schema (input_schema, tool_use
// content blocks) than the OpenAI-compatible providers below, so it's
// excluded from this tool-call-based flow.
const PROVIDER_ORDER = ["google", "openai", "groq", "openrouter"];

const TOOLS_PAYLOAD = [
  {
    type: "function" as const,
    function: {
      name: "suggest_roadmap_items",
      description: "Return exactly 5 new roadmap suggestions relevant to a TBL educational platform.",
      parameters: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            minItems: 5,
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Short, clear title in Portuguese" },
                description: { type: "string", description: "2-3 sentences explaining the value for TBL teachers/students" },
                category: { type: "string", enum: ["feature", "improvement"] },
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
  const systemPrompt = `Você é um consultor sênior de produto especializado em plataformas educacionais de Team-Based Learning (TBL).

ANTES de sugerir qualquer coisa, você DEVE entender profundamente o que este sistema faz:

## O QUE O SISTEMA FAZ (FUNCIONALIDADES CORE)

### Fluxo TBL Completo
- Professor cria uma SALA com código de 6 dígitos e QR Code
- Alunos entram na sala via código/QR e aguardam na tela de espera
- Professor inicia o TBL que segue 3 fases sequenciais:
  1. **iRAT (Individual Readiness Assurance Test)**: Cada aluno responde individualmente com sistema de distribuição de pontos (4 pontos entre alternativas A/B/C/D)
  2. **tRAT (Team Readiness Assurance Test)**: Equipes respondem juntas com sistema de raspadinha (múltiplas tentativas até acertar, pontuação decresce)
  3. **Aplicação**: Questões de aplicação/casos clínicos respondidas por equipe, liberadas uma a uma pelo professor

### Gestão Acadêmica
- Criação e gerenciamento de turmas com semestre
- Vinculação de alunos a turmas
- Criação de questionários (quizzes) com questões de múltipla escolha
- Banco de questões reutilizável entre salas
- Geração de questionários por IA (Gemini/OpenAI/Groq)
- Questionários compartilháveis entre professores

### Avaliação e Notas
- Nota máxima configurável por sala
- Pesos configuráveis: individual%, equipe%, aplicação%
- Cálculo automático de notas baseado na distribuição de pontos
- Timer opcional para cada fase (iRAT, tRAT, Aplicação)

### Sistema de Apelações
- Equipes podem apelar questões do tRAT com justificativa
- Professor revisa e aceita/rejeita apelações

### Gamificação
- Conquistas automáticas para alunos (badges)
- Leaderboard de equipes em tempo real durante tRAT

### Dashboards
- **Professor**: criar salas, gerenciar turmas, monitorar progresso em tempo real, ver relatórios
- **Aluno**: ver salas participadas, conquistas, histórico de desempenho
- **Admin**: gerenciar usuários, aprovar professores, chaves de API, analytics, roadmap

### Infraestrutura
- Autenticação com email/senha
- Aprovação manual de professores por admin
- Planos de assinatura (Free/Premium/Enterprise) com Stripe
- Sincronização em tempo real via Supabase Realtime
- Internacionalização (PT-BR, EN, ES)
- Modo offline com sync
- Analytics de uso
- Pipeline de atualizações/changelog

## SUA TAREFA

Considerando TUDO acima e a lista de funcionalidades já existentes/planejadas abaixo, sugira EXATAMENTE 5 funcionalidades que:
1. São DIRETAMENTE RELEVANTES para o contexto de TBL e educação
2. COMPLEMENTAM o fluxo existente (não reinventam o que já existe)
3. Resolveriam problemas REAIS de professores e alunos que usam TBL
4. São VIÁVEIS tecnicamente com a stack atual (React + Supabase + Edge Functions)
5. NÃO são genéricas (nada de "chat", "fórum", "rede social" — a menos que seja específico para TBL)

EXEMPLOS de boas sugestões:
- Relatório comparativo de desempenho entre turmas/semestres
- Exportação de notas em formato compatível com sistemas acadêmicos (CSV/XLSX)
- Modo de prática/simulado para alunos antes do TBL real
- Feedback automático por IA sobre padrões de erro dos alunos
- Templates de questionário por disciplina

EXEMPLOS de sugestões RUINS (NÃO FAÇA):
- "Sistema de chat em tempo real" (genérico, não é core de TBL)
- "Marketplace de conteúdo" (fora do escopo)
- "Integração com redes sociais" (irrelevante)
- "Sistema de videoconferência" (fora do escopo)`;

  const userPrompt = `## FUNCIONALIDADES JÁ EXISTENTES OU PLANEJADAS (NÃO REPITA NENHUMA):

${existingList}

---

Agora gere EXATAMENTE 5 sugestões de funcionalidades NOVAS, RELEVANTES e de ALTO IMPACTO para este sistema de TBL. 
Cada sugestão deve ter: title (curto e claro), description (2-3 frases explicando o valor), category (feature|improvement), priority (high|medium|low).
Foque em resolver dores reais de professores e alunos no contexto de Team-Based Learning.`;

  return { systemPrompt, userPrompt };
}

const TOOL_CHOICE = { type: "function" as const, function: { name: "suggest_roadmap_items" } };

// Parse suggestions from a shared-module AIResult's tool_calls or plain JSON content
function parseSuggestions(result: { content?: string; toolArguments?: string }): Suggestion[] | null {
  if (result.toolArguments) {
    try {
      const parsed = JSON.parse(result.toolArguments);
      if (parsed.suggestions) return parsed.suggestions;
    } catch { /* fall through */ }
  }

  // Try plain content (for providers that may not use tool_calls properly)
  if (result.content) {
    try {
      let jsonStr = result.content.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      const parsed = JSON.parse(jsonStr);
      return parsed.suggestions || (Array.isArray(parsed) ? parsed : null);
    } catch { /* fall through */ }
  }

  return null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, CORS_HEADERS_LONG);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const respond = (payload: SuggestResponse) =>
    new Response(JSON.stringify(payload), { status: 200, headers: jsonHeaders });

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
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // --- Try external providers first (prioritize Google) ---
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let providerUsed: string | null = null;
    let suggestions: Suggestion[] | null = null;

    try {
      const apiKeys = await getConfiguredApiKeys(adminClient);

      if (apiKeys.length > 0) {
        for (const providerName of PROVIDER_ORDER) {
          const keyRow = apiKeys.find((k) => k.provider === providerName);
          if (!keyRow) continue;

          console.log(`[ROADMAP-AI] Trying provider: ${providerName}`);
          const aiResult = await tryExternalProvider(providerName, keyRow.api_key, messages, {
            tools: TOOLS_PAYLOAD,
            toolChoice: TOOL_CHOICE,
          });
          if (!aiResult) continue;

          const parsed = parseSuggestions(aiResult);
          if (!parsed || parsed.length === 0) {
            console.error(`[ROADMAP-AI] ${providerName} returned no suggestions`);
            continue;
          }

          suggestions = parsed;
          providerUsed = providerName;
          console.log(`[ROADMAP-AI] Success with provider: ${providerName} (${parsed.length} suggestions)`);
          break;
        }
      }
    } catch (e) {
      console.error("[ROADMAP-AI] Error fetching external keys, falling back:", e);
    }

    // --- Fallback to Lovable AI ---
    if (!suggestions) {
      try {
        const aiResult = await tryLovableAI(messages, {
          model: "google/gemini-3-flash-preview",
          tools: TOOLS_PAYLOAD,
          toolChoice: TOOL_CHOICE,
        });
        const parsed = parseSuggestions(aiResult);
        if (!parsed || parsed.length === 0) throw new Error("Lovable AI returned no suggestions");
        suggestions = parsed;
        providerUsed = "lovable";
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

    if (!suggestions || !providerUsed) {
      return respond({ ok: false, error: "Nenhum provedor de IA disponível.", code: "NO_PROVIDER" });
    }

    // Filter duplicates
    const existingTitles = new Set((existing || []).map((e: any) => e.title.toLowerCase().trim()));
    const filtered = suggestions.filter(
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

    console.log(`[ROADMAP-AI] Done: ${filtered.length} suggestions via ${providerUsed}`);
    return respond({ ok: true, count: filtered.length, suggestions: filtered, provider: providerUsed });
  } catch (e) {
    console.error("suggest-roadmap-ai error:", e);
    return respond({ ok: false, error: e instanceof Error ? e.message : "Unknown error", code: "UNEXPECTED_ERROR" });
  }
});

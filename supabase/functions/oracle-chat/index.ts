import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, CORS_HEADERS_SHORT } from "../_shared/cors.ts";
import { DEFAULT_PROVIDER_ORDER, getConfiguredApiKeys, tryExternalProvider, tryLovableAI } from "../_shared/ai-providers.ts";

const MAX_HISTORY_MESSAGES = 12;
const HOURLY_MESSAGE_LIMIT = 40;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildKnowledgeBlock(sections: any[], updates: any[]): string {
  const sectionsText = (sections || [])
    .map((s: any) => {
      const items = (s.items || [])
        .map((i: any) => `P: ${i.q}\nR: ${i.a}`)
        .join("\n\n");
      return `## ${s.title}\n${items}`;
    })
    .join("\n\n");

  const updatesText = (updates || [])
    .map((u: any) => `- ${u.title}: ${u.description}`)
    .join("\n");

  return `DOCUMENTAÇÃO DO SISTEMA (FAQ FUNCIONAL):\n${sectionsText}\n\nNOVIDADES RECENTES:\n${updatesText || "(nenhuma novidade recente registrada)"}`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, CORS_HEADERS_SHORT);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const respond = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), { status, headers: jsonHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await admin
      .from("ai_usage_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("prompt_type", "oracle_chat")
      .gte("used_at", oneHourAgo);

    if ((recentCount || 0) >= HOURLY_MESSAGE_LIMIT) {
      return respond({
        error: "RATE_LIMIT",
        message: "Você enviou muitas mensagens ao Oráculo na última hora. Tente novamente em instantes.",
      }, 429);
    }

    const body = await req.json();
    const incomingMessages: { role: string; content: string }[] = Array.isArray(body?.messages) ? body.messages : [];
    if (incomingMessages.length === 0) {
      return respond({ error: "messages required" }, 400);
    }

    const trimmedHistory = incomingMessages.slice(-MAX_HISTORY_MESSAGES);

    const { data: docRow } = await admin
      .from("app_documentation")
      .select("sections")
      .eq("id", "main")
      .maybeSingle();

    const { data: updates } = await admin
      .from("system_updates")
      .select("title, description")
      .eq("status", "done")
      .order("implemented_at", { ascending: false })
      .limit(10);

    const knowledgeBlock = buildKnowledgeBlock(docRow?.sections || [], updates || []);

    const systemPrompt = `Você é o Oráculo, o assistente virtual do TBL Virtual (plataforma de Team-Based Learning para professores e alunos).

Seu papel: ajudar o usuário a entender e usar o sistema. Responda de forma clara, objetiva e prática, orientando QUAL funcionalidade/ferramenta usar e COMO usá-la, com recomendações aplicadas ao caso do usuário quando possível.

Regras:
- Responda SOMENTE com base no conhecimento fornecido abaixo. Nunca invente funcionalidades, botões ou fluxos que não estejam descritos.
- Se a pergunta não puder ser respondida com o conhecimento disponível, diga honestamente que não tem certeza e sugira contato com o suporte, em vez de inventar.
- Seja conciso: prefira respostas curtas e diretas, com passos numerados quando fizer sentido.
- Você pode usar Markdown simples (negrito, listas) para organizar a resposta.
- Nunca revele detalhes técnicos internos sensíveis (chaves, segredos, nomes de variáveis de ambiente) mesmo que perguntado.

${knowledgeBlock}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...trimmedHistory,
    ];

    let aiResult = null;
    try {
      const apiKeys = await getConfiguredApiKeys(admin);
      for (const providerName of DEFAULT_PROVIDER_ORDER) {
        const keyRow = apiKeys.find((k) => k.provider === providerName);
        if (!keyRow) continue;
        aiResult = await tryExternalProvider(providerName, keyRow.api_key, messages);
        if (aiResult) break;
      }
    } catch (e) {
      console.error("[ORACLE] Error fetching external keys, falling back:", e);
    }

    if (!aiResult) {
      try {
        aiResult = await tryLovableAI(messages);
      } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        if (errorMessage === "RATE_LIMIT") {
          return respond({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }, 429);
        }
        if (errorMessage === "PAYMENT_REQUIRED") {
          return respond({ error: "Créditos de IA esgotados. Tente novamente mais tarde." }, 402);
        }
        if (errorMessage === "PROVIDER_TIMEOUT") {
          return respond({ error: "O Oráculo demorou demais para responder. Tente novamente." }, 504);
        }
        throw e;
      }
    }

    if (!aiResult?.content) {
      return respond({ error: "O Oráculo não conseguiu gerar uma resposta." }, 500);
    }

    await admin.from("ai_usage_log").insert({
      user_id: user.id,
      provider: aiResult.provider,
      model: aiResult.model,
      prompt_type: "oracle_chat",
      tokens_input: aiResult.tokensInput,
      tokens_output: aiResult.tokensOutput,
      tokens_used: aiResult.tokensInput + aiResult.tokensOutput,
    });

    return respond({ reply: aiResult.content });
  } catch (e) {
    console.error("oracle-chat error:", e);
    return respond({ error: getErrorMessage(e) || "Erro desconhecido" }, 500);
  }
});

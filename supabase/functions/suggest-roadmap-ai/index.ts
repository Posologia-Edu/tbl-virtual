import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Admin access required");

    // Fetch ALL existing updates (done + roadmap) to avoid duplicates
    const { data: existing } = await supabase
      .from("system_updates")
      .select("title, description, status, category");

    const existingList = (existing || []).map((e: any) => `- [${e.status}] ${e.title}: ${e.description}`).join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        tools: [
          {
            type: "function",
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
        ],
        tool_choice: { type: "function", function: { name: "suggest_roadmap_items" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione fundos em Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await aiResponse.text();
      console.error("AI error:", status, text);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const parsed = JSON.parse(toolCall.function.arguments);
    const suggestions = parsed.suggestions || [];

    // Double-check: filter out any that match existing titles
    const existingTitles = new Set((existing || []).map((e: any) => e.title.toLowerCase().trim()));
    const filtered = suggestions.filter((s: any) => !existingTitles.has(s.title.toLowerCase().trim()));

    // Insert into DB
    if (filtered.length > 0) {
      const payload = filtered.map((s: any) => ({
        title: s.title,
        description: s.description,
        category: s.category,
        priority: s.priority,
        status: "idea",
        tags: ["ai-generated"],
      }));

      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { error: insertError } = await serviceClient.from("system_updates").insert(payload);
      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error("Failed to insert suggestions");
      }
    }

    return new Response(JSON.stringify({ count: filtered.length, suggestions: filtered }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-roadmap-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

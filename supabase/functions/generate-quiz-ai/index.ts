import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    // Build user message content - use multimodal format for binary files
    const isTextContent = !mimeType || mimeType === 'text/plain';
    
    let userContent: any;
    if (isTextContent) {
      // Plain text - send directly
      userContent = `Analise o seguinte material de apoio (arquivo: ${fileName}) e crie as questões conforme instruído:\n\n${fileContent}`;
    } else {
      // Binary file (PDF, DOCX, PPTX) - send as multimodal with data URI
      userContent = [
        {
          type: "text",
          text: `Analise o material de apoio anexado (arquivo: ${fileName}) e crie as questões conforme instruído.`,
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${fileContent}`,
          },
        },
      ];
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Check for context length error
      if (t.includes("context length") || t.includes("too many tokens")) {
        return new Response(JSON.stringify({ error: "O arquivo é muito grande. Tente com um arquivo menor (máximo ~50 páginas)." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Erro ao gerar questões com IA. Tente com um arquivo menor." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "IA não retornou conteúdo" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse JSON from response, handling possible markdown code blocks
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

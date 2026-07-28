import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
import { getCorsHeaders, CORS_HEADERS_LONG } from "../_shared/cors.ts";
import {
  DEFAULT_PROVIDER_ORDER,
  getConfiguredApiKeys,
  tryExternalProvider,
  tryLovableAI,
  type AIResult,
} from "../_shared/ai-providers.ts";
import { checkAIPlanLimit } from "../_shared/ai-plan-limits.ts";

async function extractPdfText(base64: string): Promise<string> {
  const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const pdf = await getDocumentProxy(binary);
  const { text } = await extractText(pdf, { mergePages: true });
  const cleaned = (Array.isArray(text) ? text.join("\n") : text).trim();
  return cleaned.slice(0, 35000);
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

function extractBalancedJson(text: string): string[] {
  const results: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        results.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return results;
}

function parseGeneratedQuestions(rawContent: string) {
  const trimmed = rawContent.trim();
  const candidates: string[] = [trimmed];

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) candidates.push(fenceMatch[1].trim());

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  candidates.push(...extractBalancedJson(trimmed));

  const tryParse = (c: string) => {
    try {
      const parsed = JSON.parse(c);
      if (Array.isArray(parsed?.irat_questions) && Array.isArray(parsed?.application_questions)) {
        return parsed;
      }
    } catch { /* ignore */ }
    return null;
  };

  for (const c of candidates) {
    const p = tryParse(c);
    if (p) return p;
  }

  // Last resort: strip trailing commas
  for (const c of candidates) {
    const p = tryParse(c.replace(/,(\s*[}\]])/g, "$1"));
    if (p) return p;
  }

  console.error("[AI] Failed to parse. First 800 chars:", rawContent.slice(0, 800));
  console.error("[AI] Last 400 chars:", rawContent.slice(-400));
  throw new Error("INVALID_AI_JSON");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, CORS_HEADERS_LONG);
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

    const planCheck = await checkAIPlanLimit(adminClient, user.id, user.email!);
    if (planCheck.blocked) {
      return new Response(JSON.stringify(planCheck.body), {
        status: planCheck.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
- Formato de cada question_text:
  "[texto integral do caso clínico, 180-320 palavras, em parágrafos]|||AFIRMACAO|||[afirmação específica desta questão, sem prefixo 'Afirmação X:', apenas a afirmação a ser julgada como V ou F]"
- O TEXTO DO CASO CLÍNICO deve ser IDÊNTICO nas 3 questões (mesmo conteúdo, mesma pontuação, mesmas quebras de linha). Apenas a parte após "|||AFIRMACAO|||" muda.
- NÃO inclua "CASO CLÍNICO:", "Afirmação 1:", "Julgue como Verdadeiro ou Falso", nem qualquer rótulo — o sistema renderiza isso automaticamente.
- O enunciado é renderizado como Markdown (GFM) com KaTeX. Você PODE (opcionalmente) usar:
  • Tabelas markdown ( | col | col | + linha de --- ) para apresentar dados clínicos/laboratoriais quando fizer sentido.
  • Fórmulas LaTeX entre $...$ (inline) ou $$...$$ (bloco), ex.: $K_a = 1{,}8 \\times 10^{-5}$.
  • Listas (-, 1.) e ênfase moderada (**negrito**, *itálico*) quando agregar clareza.
  Use formatação SOMENTE quando ela melhorar a compreensão clínica/científica; texto comum ainda é o padrão.
- Em "correct_answer", use apenas "V" ou "F".

PROIBIDO:
- Omitir o caso clínico nas questões 2 e 3 (o caso DEVE estar nas 3, idêntico).
- Gerar 3 casos clínicos diferentes (deve ser 1 caso, repetido literalmente).
- Esquecer ou alterar o separador "|||AFIRMACAO|||".
- Inserir rótulos como "Afirmação X:" ou "CASO CLÍNICO:".
- Caso genérico tipo "Paciente de 30 anos com asma leve...".
- Caso com menos de 180 palavras.
- Afirmações que sejam simples reformulação direta do enunciado sem exigir raciocínio.
- Repetir o mesmo aspecto nas 3 afirmações.

Antes de responder, faça uma checagem interna: o caso tem densidade de banca? As 3 afirmações cobrem aspectos distintos? O caso é IDÊNTICO nas 3 questões? O separador "|||AFIRMACAO|||" está em todas? Não há rótulos como "Afirmação X:" ou "CASO CLÍNICO:"? Se não, reescreva.

EXPLICAÇÃO (obrigatória para cada questão do iRAT/tRAT):
- Para cada questão de iRAT/tRAT, gere um campo "explanation" com 2 a 5 frases que:
  1) Indique a alternativa correta e justifique tecnicamente por que ela está correta (com base no material).
  2) Comente brevemente por que as demais alternativas estão erradas (pode citar A, B, C, D).
- Use linguagem didática, técnica e fundamentada no material.

Responda EXCLUSIVAMENTE no formato JSON abaixo, sem nenhum texto adicional:

{
  "irat_questions": [
    {
      "question_text": "Enunciado da questão",
      "option_a": "Alternativa A",
      "option_b": "Alternativa B",
      "option_c": "Alternativa C",
      "option_d": "Alternativa D",
      "correct_option": "A",
      "explanation": "A alternativa A está correta porque ... A alternativa B está errada porque ... C está errada porque ... D está errada porque ..."
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
        for (const providerName of DEFAULT_PROVIDER_ORDER) {
          console.log(`[AI] Evaluating provider: ${providerName}`);
          const keyRow = apiKeys.find((k: any) => k.provider === providerName);
          if (!keyRow) continue;

          if (!allText && (providerName === "groq" || providerName === "anthropic")) continue;

          aiResult = await tryExternalProvider(providerName, keyRow.api_key, messages, { jsonMode: true });
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
        aiResult = await tryLovableAI(messages, { jsonMode: true });
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
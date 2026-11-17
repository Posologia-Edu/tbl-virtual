// Deterministic quality checks for generated iRAT/tRAT questions.
// Rules mirror the "padrão de desafios" used in the simulators project:
// similar option lengths, no absolutes in distractors, no "todas/nenhuma das
// anteriores", and a balanced position of the correct answer.

export interface IratQuestion {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation?: string;
}

const LETTERS = ["A", "B", "C", "D"] as const;
type Letter = (typeof LETTERS)[number];

const ABSOLUTES = /\b(sempre|nunca|apenas|somente|exclusiv[ao]s?(?:mente)?|obrigatori[ao]s?|obrigatoriamente|necessariamente|invariavelmente|unicamente|jamais|em nenhum (caso|cen[áa]rio)|em todos os (casos|cen[áa]rios)|todos os pacientes|nenhum paciente|definitiv[ao]s?|completamente|integralmente|imediatamente|totalmente)\b/i;
const ALL_NONE = /\b(todas|nenhuma) (as|das) (anteriores|alternativas)\b|\b(todas|nenhuma) as anteriores\b/i;
// Explanations that cite option letters cannot survive a reshuffle of the options.
const CITES_LETTER = /\b(alternativas?|op[çc](?:ão|ões)|letras?|itens?)\s+[A-D]\b|\(\s*[A-D]\s*\)|\b[A-D]\)/i;

function getOpt(q: IratQuestion, l: Letter): string {
  return String(q[`option_${l.toLowerCase()}` as keyof IratQuestion] ?? "");
}

function normLetter(v: string): Letter | null {
  const l = String(v ?? "").trim().toUpperCase().charAt(0);
  return (LETTERS as readonly string[]).includes(l) ? (l as Letter) : null;
}

/** Returns, per question index, the list of problems found. */
export function auditIrat(questions: IratQuestion[]): Map<number, string[]> {
  const issues = new Map<number, string[]>();
  const add = (i: number, msg: string) => issues.set(i, [...(issues.get(i) ?? []), msg]);

  questions.forEach((q, i) => {
    const correct = normLetter(q.correct_option);
    if (!correct) {
      add(i, "correct_option inválida");
      return;
    }
    const lens = LETTERS.map((l) => getOpt(q, l).trim().length);
    const mean = lens.reduce((a, b) => a + b, 0) / 4;
    const cLen = lens[LETTERS.indexOf(correct)];
    const others = lens.filter((_, idx) => idx !== LETTERS.indexOf(correct));
    if (mean > 0) {
      if (cLen > Math.max(...others) && cLen > mean * 1.15) {
        add(i, `a alternativa correta é a mais longa (${cLen} caracteres contra média ${Math.round(mean)}); alongue os distratores para tamanho parecido`);
      } else if (cLen < Math.min(...others) && cLen < mean * 0.85) {
        add(i, `a alternativa correta é a mais curta (${cLen} caracteres contra média ${Math.round(mean)}); ajuste os distratores para tamanho parecido`);
      }
    }
    if (!/segundo o material/i.test(q.explanation ?? "")) add(i, "a explicação não termina com \"Segundo o material: «trecho literal»\"");
    // Long stem words that appear ONLY in the correct option are a giveaway.
    const stemWords = new Set((q.question_text.toLowerCase().match(/[a-zà-ú0-9]{10,}/g) ?? []));
    const correctText = getOpt(q, correct).toLowerCase();
    const leaks = [...stemWords].filter(
      (w) => correctText.includes(w) && LETTERS.filter((l) => l !== correct).every((l) => !getOpt(q, l).toLowerCase().includes(w)),
    );
    if (leaks.length > 0) add(i, `a palavra-chave do enunciado "${leaks[0]}" aparece só na alternativa correta; reformule para não entregar a resposta`);
    LETTERS.forEach((l) => {
      const t = getOpt(q, l);
      if (ALL_NONE.test(t)) add(i, `alternativa ${l} usa "todas/nenhuma das anteriores"`);
      if (l !== correct && ABSOLUTES.test(t)) add(i, `distrator ${l} usa termo absoluto (sempre/nunca/apenas/somente...)`);
    });
  });
  return issues;
}

/**
 * Rebalances the position of the correct answer by permuting options.
 * Questions whose explanation cites letters are left untouched.
 */
export function balanceCorrectPositions(questions: IratQuestion[]): IratQuestion[] {
  const n = questions.length;
  // Target letters: as even as possible, in random order.
  const targets: Letter[] = Array.from({ length: n }, (_, i) => LETTERS[i % 4]);
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }

  return questions.map((q, i) => {
    const correct = normLetter(q.correct_option);
    if (!correct || CITES_LETTER.test(q.explanation ?? "")) return q;
    const target = targets[i];
    if (target === correct) return q;

    // Swap the correct option with the one currently at the target position.
    const out: IratQuestion = { ...q, correct_option: target };
    const ck = `option_${correct.toLowerCase()}` as "option_a";
    const tk = `option_${target.toLowerCase()}` as "option_a";
    out[ck] = q[tk];
    out[tk] = q[ck];
    return out;
  });
}

export interface AppQuestion {
  question_text: string;
  correct_answer: string;
  explanation?: string;
}

const SEP = "|||AFIRMACAO|||";

/** Automated checks for the case-based V/F statements. */
export function auditApp(app: AppQuestion[]): string[] {
  const out: string[] = [];
  const answers = app.map((a) => String(a.correct_answer ?? "").trim().toUpperCase().charAt(0));
  if (app.length >= 2 && answers.every((a) => a === answers[0])) {
    out.push(
      `as ${app.length} afirmações têm o mesmo gabarito (${answers[0]}); reescreva ao menos uma para ter gabarito ${answers[0] === "V" ? "F" : "V"}, com um ERRO TÉCNICO REAL (dose, critério, conduta, mecanismo ou classificação trocados), não apenas um absoluto`,
    );
  }
  app.forEach((a, i) => {
    const st = a.question_text.split(SEP)[1] ?? "";
    if (answers[i] === "F" && ABSOLUTES.test(st)) out.push(`a afirmação ${i + 1} é falsa e usa termo absoluto; a falsidade deve vir de um erro técnico real`);
  });
  return out;
}

export function buildReviewInstruction(
  questions: IratQuestion[],
  issues: Map<number, string[]>,
  app: AppQuestion[],
): string {
  const iratItems = questions.map((q, i) => ({
    indice: i,
    problemas_automaticos: issues.get(i) ?? [],
    questao: q,
  }));
  const caso = app[0]?.question_text.split(SEP)[0] ?? "";
  const appProblems = auditApp(app);
  const appItems = app.map((a, i) => ({
    indice: i,
    afirmacao: a.question_text.split(SEP)[1] ?? "",
    gabarito: a.correct_answer,
    explicacao: a.explanation ?? "",
  }));
  return `REVISÃO CRÍTICA. Você é um revisor exigente de provas de residência. Revise as questões abaixo contra o MATERIAL fornecido e REESCREVA SOMENTE as que tiverem algum defeito, mantendo o conteúdo-alvo do material.

A) QUESTÕES DE iRAT. Teste de chute (aplique a cada uma): "Um aluno que NÃO estudou acertaria por bom senso, por eliminar alternativas absurdas ou por pistas no enunciado?". Se sim, reescreva. Defeitos que exigem reescrita:
- distrator absurdo, de outra categoria da correta ou "contrário impossível" da correta; todos os distratores devem ser da MESMA categoria e REAIS (se a pergunta é sobre associações de fármacos, todas devem ser associações reais);
- o enunciado entrega quais alternativas são erradas (ex.: cita "em comparação com a asma" e três alternativas são claramente de asma) ou repete palavra-chave que só aparece na correta;
- absoluto em distrator (definitiva, imediata, completa, total, sempre, nunca, apenas, somente, exclusiva, obrigatoriamente...);
- alternativas com tamanho diferente (a correta não pode ser a mais longa nem a mais curta, diferença de até ~10%);
- o enunciado afirma "deve" onde o material diz "considerar/pode/sugere", ou afirma algo que o material não sustenta;
- fármaco, associação, dose ou valor que não existe ou não consta do material;
- explicação que cita letras de alternativas ou que não termina com: Segundo o material: «trecho literal curto» (o trecho deve existir no material e sustentar EXATAMENTE a resposta; se o fato não tem sustentação, troque o fato);
- duas questões testando o mesmo subtópico (a mais fraca deve ser trocada por outro tópico do material).

B) AFIRMAÇÕES V/F do caso clínico. Para cada uma verifique:
- o trecho citado em "Segundo o material" sustenta EXATAMENTE a afirmação (mesmo parâmetro, mesma comparação, mesmo grupo de pacientes). Se o trecho fala de outra comparação, reescreva a afirmação ou o gabarito;
- uma afirmação NÃO pode ser falsa apenas por causa de um absoluto ("obrigatória", "sempre", "nunca", "independentemente", "exclusivamente"); a falsidade deve vir de um erro técnico real;
- o gabarito é defensável pelo material e pelo caso (dados numéricos do caso coerentes com a afirmação);
- não repete tema já testado nas questões de iRAT (ex.: se o iRAT já cobra a antibioticoterapia ou a classificação GOLD, a afirmação deve testar outro raciocínio sobre o caso); as 3 afirmações NÃO podem ter o mesmo gabarito: pelo menos uma deve ser FALSA, com um erro técnico real e plausível (dose trocada, critério errado, conduta inadequada ao caso), e pelo menos uma VERDADEIRA;
- afirmações do tipo "o paciente deve receber X" só são V se o material sustenta X para ESTE perfil; se o caso tem uma armadilha (ex.: internação por pneumonia não é exacerbação de DPOC), use-a;
- explicação termina com: Segundo o material: «trecho literal curto».
NÃO altere o caso clínico; reescreva apenas a afirmação, o gabarito e a explicação.

Responda EXCLUSIVAMENTE em JSON, incluindo apenas os itens reescritos:
{"irat_questions":[{"indice":<mesmo índice>,"question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"A","explanation":"..."}],
 "application_questions":[{"indice":<mesmo índice>,"afirmacao":"...","correct_answer":"V","explanation":"..."}]}
Se nada precisar de ajuste, responda {"irat_questions":[],"application_questions":[]}.

CASO CLÍNICO (compartilhado):
${caso}

QUESTÕES DE iRAT:
${JSON.stringify(iratItems, null, 2)}

AFIRMAÇÕES V/F:
${JSON.stringify(appItems, null, 2)}

PROBLEMAS AUTOMÁTICOS DAS AFIRMAÇÕES (corrija obrigatoriamente): ${JSON.stringify(appProblems)}`;
}

/** Applies reviewed items (matched by "indice") if they are structurally valid. */
export function applyReview(
  questions: IratQuestion[],
  app: AppQuestion[],
  raw: string,
): { irat: IratQuestion[]; app: AppQuestion[]; changedIrat: number; changedApp: number } {
  let parsed: any;
  try {
    parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    return { irat: questions, app, changedIrat: 0, changedApp: 0 };
  }
  const irat = [...questions];
  let changedIrat = 0;
  for (const f of Array.isArray(parsed?.irat_questions) ? parsed.irat_questions : []) {
    const idx = Number(f?.indice);
    if (!Number.isInteger(idx) || idx < 0 || idx >= irat.length) continue;
    if (!f.question_text || !f.option_a || !f.option_b || !f.option_c || !f.option_d || !normLetter(f.correct_option)) continue;
    irat[idx] = {
      question_text: String(f.question_text),
      option_a: String(f.option_a),
      option_b: String(f.option_b),
      option_c: String(f.option_c),
      option_d: String(f.option_d),
      correct_option: normLetter(f.correct_option)!,
      explanation: f.explanation ? String(f.explanation) : irat[idx].explanation,
    };
    changedIrat++;
  }
  const out = [...app];
  let changedApp = 0;
  for (const f of Array.isArray(parsed?.application_questions) ? parsed.application_questions : []) {
    const idx = Number(f?.indice);
    if (!Number.isInteger(idx) || idx < 0 || idx >= out.length) continue;
    const ans = String(f?.correct_answer ?? "").trim().toUpperCase().charAt(0);
    if (!f.afirmacao || (ans !== "V" && ans !== "F")) continue;
    const caso = out[idx].question_text.split(SEP)[0];
    out[idx] = {
      ...out[idx],
      question_text: `${caso}${SEP}${String(f.afirmacao).trim()}`,
      correct_answer: ans,
      explanation: f.explanation ? String(f.explanation) : out[idx].explanation,
    };
    changedApp++;
  }
  return { irat, app: out, changedIrat, changedApp };
}

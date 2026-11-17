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

const ABSOLUTES = /\b(sempre|nunca|apenas|somente|exclusivamente|jamais|em nenhum (caso|cen[áa]rio)|em todos os (casos|cen[áa]rios)|todos os pacientes|nenhum paciente|definitiv[ao]s?|completamente|integralmente|imediatamente|totalmente)\b/i;
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

export function buildRepairInstruction(questions: IratQuestion[], issues: Map<number, string[]>): string {
  const items = questions.map((q, i) => ({
    indice: i,
    problemas_automaticos: issues.get(i) ?? [],
    questao: q,
  }));
  return `REVISÃO CRÍTICA DAS QUESTÕES DE iRAT. Você é um revisor exigente de provas de residência. Revise TODAS as questões abaixo contra o material fornecido e REESCREVA SOMENTE as que tiverem algum defeito, mantendo o conteúdo-alvo do material.

Teste de chute (aplique a cada questão): "Um aluno que NÃO estudou o material acertaria por bom senso, por eliminar alternativas absurdas ou por pistas no enunciado?". Se sim, reescreva.

Defeitos que exigem reescrita:
- distrator absurdo, de outra categoria da correta (ex.: um corticoide numa pergunta sobre antibiótico) ou "contrário impossível" da correta; todos os distratores devem ser da MESMA categoria e REAIS (se a pergunta é sobre associações de fármacos, todas devem ser associações reais);
- o enunciado entrega quais alternativas são erradas (ex.: cita "em comparação com a asma" e duas alternativas são claramente de asma) ou repete palavra-chave da correta;
- absoluto disfarçado em distrator (definitiva, imediata, completa, total, sempre, nunca, apenas, somente);
- alternativas com tamanho diferente (a correta não pode ser a mais longa nem a mais curta, diferença de até ~10%);
- o enunciado afirma "deve" onde o material diz "considerar/pode/sugere", ou afirma algo que o material não sustenta;
- fármaco, associação, dose ou valor que não existe ou não consta do material;
- explicação que cita letras de alternativas (descreva pelo conteúdo) ou que não termina com: Segundo o material: «trecho literal curto» (o trecho deve existir no material; se o fato não tem sustentação no material, troque o fato).
Ao reescrever, mantenha o mesmo fato de base do material e eleve a plausibilidade dos distratores (leituras parciais, valores próximos, mecanismos de classes vizinhas). Mantenha 4 alternativas.

O campo "problemas_automaticos" lista defeitos já detectados por código; corrija-os, mas também aplique o teste acima às questões sem problemas listados.

Responda EXCLUSIVAMENTE em JSON, incluindo apenas as questões reescritas: {"irat_questions":[{"indice":<mesmo índice>,"question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"A","explanation":"..."}]}. Se nenhuma precisar de ajuste, responda {"irat_questions":[]}.

QUESTÕES:
${JSON.stringify(items, null, 2)}`;
}

/** Applies repaired questions (matched by "indice") if they are structurally valid. */
export function applyRepairs(questions: IratQuestion[], raw: string): IratQuestion[] {
  let parsed: any;
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return questions;
  }
  const fixed = Array.isArray(parsed?.irat_questions) ? parsed.irat_questions : [];
  const out = [...questions];
  for (const f of fixed) {
    const idx = Number(f?.indice);
    if (!Number.isInteger(idx) || idx < 0 || idx >= out.length) continue;
    if (!f.question_text || !f.option_a || !f.option_b || !f.option_c || !f.option_d || !normLetter(f.correct_option)) continue;
    out[idx] = {
      question_text: String(f.question_text),
      option_a: String(f.option_a),
      option_b: String(f.option_b),
      option_c: String(f.option_c),
      option_d: String(f.option_d),
      correct_option: normLetter(f.correct_option)!,
      explanation: f.explanation ? String(f.explanation) : out[idx].explanation,
    };
  }
  return out;
}

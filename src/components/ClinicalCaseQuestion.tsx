import { FileText, HelpCircle } from "lucide-react";

interface ClinicalCaseQuestionProps {
  text: string;
  questionNumber?: number;
  compact?: boolean;
  /** Render only the clinical case card (omit the assertion) */
  caseOnly?: boolean;
  /** Render only the assertion card (omit the clinical case) */
  statementOnly?: boolean;
}

export const CLINICAL_CASE_SEPARATOR = "|||AFIRMACAO|||";

/** Splits a question_text into { caseText, statement }. If no separator, caseText is "" and statement is the full text. */
export function splitClinicalCase(text: string): { caseText: string; statement: string; hasCase: boolean } {
  const idx = text.indexOf(CLINICAL_CASE_SEPARATOR);
  if (idx === -1) return { caseText: "", statement: text, hasCase: false };
  return {
    caseText: text.slice(0, idx).trim(),
    statement: text.slice(idx + CLINICAL_CASE_SEPARATOR.length).trim(),
    hasCase: true,
  };
}

/**
 * Renders an application question that may contain a clinical case + V/F statement
 * separated by the literal marker "|||AFIRMACAO|||".
 * If the marker is absent, renders the text as-is (backward compatible).
 */
export function ClinicalCaseQuestion({
  text,
  questionNumber,
  compact,
  caseOnly,
  statementOnly,
}: ClinicalCaseQuestionProps) {
  const { caseText, statement, hasCase } = splitClinicalCase(text);

  if (!hasCase) {
    return (
      <p className={`${compact ? "text-sm" : "text-base"} leading-relaxed whitespace-pre-line`}>
        {questionNumber ? `Q${questionNumber}. ` : ""}{statement}
      </p>
    );
  }

  const caseCard = (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        Caso clínico
      </div>
      <p className={`${compact ? "text-sm" : "text-base"} leading-relaxed whitespace-pre-line text-foreground`}>
        {caseText}
      </p>
    </div>
  );

  const statementCard = (
    <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
        <HelpCircle className="h-3.5 w-3.5" />
        Afirmação{questionNumber ? ` ${questionNumber}` : ""} — Julgue como Verdadeiro ou Falso
      </div>
      <p className={`${compact ? "text-sm" : "text-base"} leading-relaxed whitespace-pre-line font-medium text-foreground`}>
        {statement}
      </p>
    </div>
  );

  if (caseOnly) return caseCard;
  if (statementOnly) return statementCard;

  return (
    <div className="space-y-4">
      {caseCard}
      {statementCard}
    </div>
  );
}

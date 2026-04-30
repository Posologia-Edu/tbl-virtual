import { FileText, HelpCircle } from "lucide-react";
import { QuestionRichRenderer, parseMedia, MediaBlock } from "./QuestionMedia";

interface ClinicalCaseQuestionProps {
  text: string;
  questionNumber?: number;
  compact?: boolean;
  /** Render only the clinical case card (omit the assertion) */
  caseOnly?: boolean;
  /** Render only the assertion card (omit the clinical case) */
  statementOnly?: boolean;
  /** Optional media blocks tied to this question (rendered with the statement). */
  media?: any;
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

export function ClinicalCaseQuestion({
  text,
  questionNumber,
  compact,
  caseOnly,
  statementOnly,
  media,
}: ClinicalCaseQuestionProps) {
  const { caseText, statement, hasCase } = splitClinicalCase(text);

  if (!hasCase) {
    return (
      <div>
        {questionNumber ? <span className="font-medium mr-1">Q{questionNumber}.</span> : null}
        <QuestionRichRenderer text={statement} media={media} compact={compact} />
      </div>
    );
  }

  const caseCard = (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        Caso clínico
      </div>
      <QuestionRichRenderer text={caseText} compact={compact} />
    </div>
  );

  const statementCard = (
    <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
        <HelpCircle className="h-3.5 w-3.5" />
        Afirmação{questionNumber ? ` ${questionNumber}` : ""} — Julgue como Verdadeiro ou Falso
      </div>
      <QuestionRichRenderer text={statement} media={media} compact={compact} />
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

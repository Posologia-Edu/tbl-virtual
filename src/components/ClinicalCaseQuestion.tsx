import { FileText, HelpCircle } from "lucide-react";

interface ClinicalCaseQuestionProps {
  text: string;
  questionNumber?: number;
  compact?: boolean;
}

/**
 * Renders an application question that may contain a clinical case + V/F statement
 * separated by the literal marker "|||AFIRMACAO|||".
 * If the marker is absent, renders the text as-is (backward compatible).
 */
export function ClinicalCaseQuestion({ text, questionNumber, compact }: ClinicalCaseQuestionProps) {
  const SEP = "|||AFIRMACAO|||";
  const idx = text.indexOf(SEP);

  if (idx === -1) {
    return (
      <p className={`${compact ? "text-sm" : "text-base"} leading-relaxed whitespace-pre-line`}>
        {questionNumber ? `Q${questionNumber}. ` : ""}{text}
      </p>
    );
  }

  const caseText = text.slice(0, idx).trim();
  const statement = text.slice(idx + SEP.length).trim();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          Caso clínico
        </div>
        <p className={`${compact ? "text-sm" : "text-base"} leading-relaxed whitespace-pre-line text-foreground`}>
          {caseText}
        </p>
      </div>

      <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
          <HelpCircle className="h-3.5 w-3.5" />
          Afirmação{questionNumber ? ` ${questionNumber}` : ""} — Julgue como Verdadeiro ou Falso
        </div>
        <p className={`${compact ? "text-sm" : "text-base"} leading-relaxed whitespace-pre-line font-medium text-foreground`}>
          {statement}
        </p>
      </div>
    </div>
  );
}

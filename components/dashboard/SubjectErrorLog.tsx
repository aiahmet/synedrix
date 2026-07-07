import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { Crosshair, GitFork } from "@/components/landing/icons";
export interface SubjectMistake {
  readonly id: string;
  readonly question: string;
  readonly userAnswer: string;
  readonly correctAnswer: string;
  readonly mistakeType: string;
  readonly attemptedAt: number;
  readonly topicSlug: string;
  readonly topicTitle: string;
  readonly chapterSlug: string;
}
const MISTAKE_META: Record<string, { label: string; color: string }> = {
  CONCEPT_MISUNDERSTANDING: {
    label: "Concept",
    color: "var(--subject-math)",
  },
  CALCULATION_MISTAKE: {
    label: "Calculation",
    color: "var(--subject-chemistry)",
  },
  CARELESS_ERROR: {
    label: "Careless",
    color: "var(--subject-physics)",
  },
  FORMULA_RECALL_FAILURE: {
    label: "Recall",
    color: "var(--subject-german)",
  },
  MISREAD_QUESTION: {
    label: "Misread",
    color: "var(--subject-french)",
  },
  LANGUAGE_EXPRESSION_ISSUE: {
    label: "Language",
    color: "var(--subject-english)",
  },
};
function getMistakeMeta(type: string) {
  return (
    MISTAKE_META[type] ?? { label: type, color: "var(--accent)" }
  );
}
export function SubjectErrorLog({
  mistakes,
  subjectSlug,
  subjectColor,
}: {
  readonly mistakes: readonly SubjectMistake[];
  readonly subjectSlug: string;
  readonly subjectColor?: string;
}) {
  void subjectColor;
  void subjectSlug;
  if (mistakes.length === 0) {
    return (
      <CockpitCard>
        <CockpitCardHeader label="Error log" />
        <div className="flex items-start gap-3">
          <Crosshair
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
            weight="duotone"
          />
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            No mistakes recorded in this subject yet. The log populates
            automatically as you complete practice sessions.
          </p>
        </div>
      </CockpitCard>
    );
  }
  const typeCounts = new Map<string, number>();
  for (const m of mistakes) {
    typeCounts.set(m.mistakeType, (typeCounts.get(m.mistakeType) ?? 0) + 1);
  }
  const topTypes = Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Error log"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {mistakes.length} entries
          </span>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {topTypes.map(([type, count]) => {
          const meta = getMistakeMeta(type);
          return (
            <span
              key={type}
              className="inline-flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em]"
              style={{ color: meta.color }}
            >
              <GitFork className="h-2.5 w-2.5" weight="bold" />
              {meta.label}
              <span className="tabular-nums opacity-70">
                {count}
              </span>
            </span>
          );
        })}
      </div>
      <div className="flex flex-col divide-y divide-border/40">
        {mistakes.slice(0, 8).map((m) => {
          return (
            <div
              key={m.id}
              className="py-2.5 first:pt-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[12px] font-medium leading-snug text-foreground">
                    {m.question}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span className="inline-flex items-center gap-1">
                      <span className="text-muted-foreground">You:</span>
                      <span
                        className="font-medium"
                        style={{ color: "var(--subject-french)" }}
                      >
                        {m.userAnswer || "—"}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="text-muted-foreground">Correct:</span>
                      <span className="font-medium text-accent">
                        {m.correctAnswer || "—"}
                      </span>
                    </span>
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {m.topicTitle}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {mistakes.length > 8 && (
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          +{mistakes.length - 8} more entries across this subject
        </p>
      )}
    </CockpitCard>
  );
}

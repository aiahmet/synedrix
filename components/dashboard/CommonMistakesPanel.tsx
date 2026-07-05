"use client";

import {
  CockpitCard,
  CockpitCardHeader,
} from "@/components/dashboard/CockpitCard";
import { Crosshair, GitFork } from "@/components/landing/icons";

/**
 * Mistake entry shape — mirrors the slice returned by
 * `api.subjects.getTopicDetailBySlug.commonMistakes`.
 */
export interface CommonMistakeEntry {
  readonly id: string;
  readonly question: string;
  readonly userAnswer: string;
  readonly correctAnswer: string;
  readonly mistakeType: string;
  readonly attemptedAt: number;
}

/**
 * Pre-seeded mistake shape (from lessonBlocks.commonMistakes).
 */
export interface PreSeededMistakeEntry {
  readonly mistake: string;
  readonly correction: string;
  readonly cause: string;
}

const MISTAKE_META: Record<string, { label: string; color: string }> = {
  CONCEPT_MISUNDERSTANDING: GM("concept"),
  CALCULATION_MISTAKE: GM("calculation"),
  CARELESS_ERROR: GM("careless"),
  FORMULA_RECALL_FAILURE: GM("formula"),
  MISREAD_QUESTION: GM("misread"),
  LANGUAGE_EXPRESSION_ISSUE: GM("language"),
};

function GM(kind: string): { label: string; color: string } {
  const palette: Record<string, string> = {
    concept: "var(--subject-math)",
    calculation: "var(--subject-chemistry)",
    careless: "var(--subject-physics)",
    formula: "var(--subject-german)",
    misread: "var(--subject-french)",
    language: "var(--subject-english)",
  };
  const labels: Record<string, string> = {
    concept: "Concept",
    calculation: "Calculation",
    careless: "Careless",
    formula: "Recall",
    misread: "Misread",
    language: "Language",
  };
  return { label: labels[kind] ?? "Note", color: palette[kind] ?? "var(--accent)" };
}

/**
 * CommonMistakesPanel.
 *
 * Merges pre-seeded common mistakes (from the canonical
 * lessonBlocks.commonMistakes) with the user's mistake history
 * (from mistakeEntries). Pre-seeded mistakes render first with
 * a distinct eyebrow; user history follows.
 */
export function CommonMistakesPanel({
  mistakes,
  preSeededMistakes,
}: {
  readonly mistakes: readonly CommonMistakeEntry[];
  readonly preSeededMistakes?: readonly PreSeededMistakeEntry[];
}) {
  const hasPreSeeded = preSeededMistakes && preSeededMistakes.length > 0;
  const hasUserHistory = mistakes.length > 0;

  if (!hasPreSeeded && !hasUserHistory) {
    return (
      <CockpitCard>
        <CockpitCardHeader label="Common mistakes" />
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }} aria-hidden>
            <Crosshair className="h-4 w-4" weight="duotone" />
          </span>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            No mistakes recorded on this topic yet. Keep working through the lesson blocks — the journal will start populating as you practice.
          </p>
        </div>
      </CockpitCard>
    );
  }

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Common mistakes"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {hasPreSeeded ? "Canonical" : ""}{hasPreSeeded && hasUserHistory ? " + " : ""}{hasUserHistory ? `Last ${mistakes.length}` : ""}
          </span>
        }
      />

      {/* Pre-seeded canonical mistakes */}
      {hasPreSeeded && (
        <div className="flex flex-col gap-2.5 mb-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Typical mistakes on this topic
          </p>
          {preSeededMistakes!.map((m, i) => (
            <div key={i} className="rounded-lg border border-subject-accent/20 bg-subject-accent/[0.04] p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-medium leading-snug text-foreground">
                  {m.mistake}
                </p>
                <span className="shrink-0 rounded-full bg-accent-subtle px-1.5 py-0.5 font-mono text-[9px] text-accent">
                  Canonical
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Correction</dt>
                  <dd className="text-[12px] font-medium" style={{ color: "var(--accent)" }}>{m.correction}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Cause</dt>
                  <dd className="text-[12px] text-muted-foreground">{m.cause}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}

      {/* User's mistake history */}
      {hasUserHistory && (
        <div className="flex flex-col gap-2.5">
          {hasPreSeeded && (
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Your mistake journal
            </p>
          )}
          {mistakes.map((m) => {
            const meta = MISTAKE_META[m.mistakeType] ?? { label: m.mistakeType, color: "var(--accent)" };
            return (
              <div key={m.id} className="rounded-lg border border-border/60 bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">{m.question}</p>
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.16em]" style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 10%, transparent)`, borderColor: `color-mix(in srgb, ${meta.color} 28%, transparent)`, color: meta.color }}>
                    <GitFork className="h-2.5 w-2.5" weight="bold" />
                    {meta.label}
                  </span>
                </div>
                <dl className="mt-2.5 grid grid-cols-1 gap-1.5 text-[12px] leading-relaxed sm:grid-cols-2">
                  <div className="flex items-baseline gap-2">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">You</dt>
                    <dd className="truncate font-medium" style={{ color: "var(--subject-french)" }}>{m.userAnswer || "—"}</dd>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Correct</dt>
                    <dd className="truncate font-medium" style={{ color: "var(--accent)" }}>{m.correctAnswer || "—"}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </CockpitCard>
  );
}

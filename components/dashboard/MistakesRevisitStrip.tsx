"use client";

import { useState } from "react";
import Link from "next/link";
import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { ArrowRight, WarningCircle } from "@/components/landing/icons";
import { formatRelativeDate } from "@/lib/format/relativeDate";
import { resolveColorVar } from "@/lib/utils/subjectColor";

export interface MistakesRevisitEntry {
  readonly id: string;
  readonly topicId: string | null;
  readonly question: string;
  readonly mistakeType: string;
  readonly reviewAt: number | null;
  readonly topicSlug: string | null;
  readonly topicTitle: string | null;
  readonly chapterSlug: string | null;
  readonly subjectSlug: string | null;
  readonly subjectTitle: string | null;
  readonly subjectColor: string | null;
}

const MISTAKE_LABELS: Record<string, string> = {
  CONCEPT_MISUNDERSTANDING: "Concept gap",
  CALCULATION_MISTAKE: "Calculation",
  CARELESS_ERROR: "Careless",
  FORMULA_RECALL_FAILURE: "Formula recall",
  MISREAD_QUESTION: "Misread",
  LANGUAGE_EXPRESSION_ISSUE: "Expression",
  SIGN_ERROR: "Sign error",
  UNIT_CONVERSION_ERROR: "Unit error",
  GRAMMAR_ERROR: "Grammar",
  VOCABULARY_ERROR: "Vocabulary",
  REACTION_BALANCE_ERROR: "Reaction",
  ARGUMENT_STRUCTURE_ISSUE: "Argument",
};

function labelFor(mistakeType: string): string {
  return MISTAKE_LABELS[mistakeType] ?? mistakeType.replace(/_/g, " ").toLowerCase();
}

export function MistakesRevisitStrip({
  data,
}: {
  readonly data: readonly MistakesRevisitEntry[];
}) {
  const [now] = useState(() => Date.now());
  if (data.length === 0) return null;

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Mistakes worth revisiting"
        trailing={
          <Link
            href="/review"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-accent-border hover:text-foreground"
          >
            Review center
            <ArrowRight className="h-3 w-3" weight="bold" />
          </Link>
        }
      />
      <ul className="flex flex-col divide-y divide-border/60">
        {data.map((entry) => {
          const fillVar = resolveColorVar(entry.subjectColor);
          const href =
            entry.subjectSlug && entry.chapterSlug && entry.topicSlug
              ? `/subjects/${entry.subjectSlug}/${entry.chapterSlug}/${entry.topicSlug}?review=mistakes`
              : "/review";
          const isOverdue =
            entry.reviewAt !== null && entry.reviewAt < now;

          return (
            <li key={entry.id} className="py-2.5 first:pt-0 last:pb-0">
              <Link
                href={href}
                className="group flex items-center gap-3 rounded-lg px-1 py-1 outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${fillVar} 14%, transparent)`,
                    borderColor: `color-mix(in srgb, ${fillVar} 28%, transparent)`,
                    color: fillVar,
                  }}
                  aria-hidden
                >
                  <WarningCircle className="h-3.5 w-3.5" weight="duotone" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[12.5px] font-semibold tracking-tight text-foreground">
                      {entry.topicTitle ?? "Unknown topic"}
                    </p>
                    <span className="rounded-full border border-border/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                      {labelFor(entry.mistakeType)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {entry.question.length > 80
                      ? entry.question.slice(0, 80) + "..."
                      : entry.question}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  {entry.reviewAt !== null && (
                    <span
                      className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
                      style={{
                        color: isOverdue
                          ? "var(--subject-french)"
                          : "var(--muted-foreground)",
                      }}
                    >
                      {isOverdue
                        ? "Overdue"
                        : formatRelativeDate(entry.reviewAt)}
                    </span>
                  )}
                  {entry.subjectTitle && (
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
                      {entry.subjectTitle}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </CockpitCard>
  );
}

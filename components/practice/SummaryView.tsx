"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface ExamGradeEntry {
  readonly verdict: "correct" | "partially_correct" | "incorrect";
  readonly score: number;
  readonly feedback: string;
  readonly betterAnswer: string;
}
import {
  CockpitCard,
  CockpitCardHeader,
} from "@/components/dashboard/CockpitCard";
import {
  ArrowLeft,
  ChatCircleText,
  CheckCircle,
  ClockCounterClockwise,
  Pulse,
  X,
} from "@/components/landing/icons";
import { AIMarkdown } from "@/lib/content/aiMarkdown";
import {
  GERMAN_GRADE_LABELS,
  type GermanLetterGrade,
} from "@/lib/ai/prompts/grading";

export function SummaryView({
  runId,
  onReset,
  onRetryWrong,
  examGrades,
}: {
  readonly runId: string;
  readonly onReset: () => void;
  readonly onRetryWrong?: (wrongItemIds: string[]) => void;
  readonly examGrades?: Map<string, ExamGradeEntry>;
}) {
  const run = useQuery(
    api.practiceArena.getArenaRun,
    { runId: runId as Id<"topicLessonPractice"> }
  );
  const items = useQuery(
    api.practiceArena.getArenaRunItems,
    { runId: runId as Id<"topicLessonPractice"> }
  );

  const grade: GermanLetterGrade = run?.grade ?? "6";
  const gradeLabel = GERMAN_GRADE_LABELS[grade].label;
  const scorePct = Math.round((run?.overallScore ?? 0) * 100);

  const augmentedItems = useMemo(
    () =>
      (items ?? []).map((item) => {
        if (item.attempt) return item;
        const grade = examGrades?.get(item.itemId);
        if (!grade) return item;
        return {
          ...item,
          attempt: {
            userAnswer: "",
            verdict: grade.verdict,
            score: grade.score,
            feedback: grade.feedback,
            betterAnswer: grade.betterAnswer,
          },
        };
      }),
    [items, examGrades]
  );

  const correct = useMemo(
    () => augmentedItems.filter((i) => i.attempt?.verdict === "correct").length,
    [augmentedItems]
  );
  const partial = useMemo(
    () => augmentedItems.filter((i) => i.attempt?.verdict === "partially_correct").length,
    [augmentedItems]
  );
  const wrong = useMemo(
    () => augmentedItems.filter((i) => i.attempt?.verdict === "incorrect").length,
    [augmentedItems]
  );

  const wrongItems = useMemo(
    () =>
      augmentedItems.filter(
        (i) =>
          i.attempt?.verdict === "incorrect" ||
          i.attempt?.verdict === "partially_correct"
      ),
    [augmentedItems]
  );

  const gradeTone =
    grade === "1" || grade === "2"
      ? "var(--subject-chemistry)"
      : grade === "3"
        ? "var(--subject-german)"
        : "var(--subject-french)";

  const modeLabel =
    run?.mode === "timed"
      ? "Timed"
      : run?.mode === "exam_simulation"
        ? "Exam Simulation"
        : run?.mode === "retry_wrong"
          ? `Retry Wrong (round ${run.currentRound ?? 1})`
          : "Sequential";

  const canRetry = wrongItems.length > 0 && run?.mode !== "retry_wrong" && onRetryWrong;

  if (!run || !items) {
    return (
      <CockpitCard>
        <div className="h-4 w-40 animate-pulse rounded bg-muted/30" />
      </CockpitCard>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <CockpitCard>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
          <div
            className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: `color-mix(in srgb, ${gradeTone} 12%, transparent)`,
              borderColor: `color-mix(in srgb, ${gradeTone} 40%, transparent)`,
            }}
          >
            <div className="flex flex-col items-center">
              <span
                className="text-[56px] font-semibold leading-none tracking-[-0.04em]"
                style={{ color: gradeTone }}
              >
                {grade}
              </span>
              <span
                className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.18em]"
                style={{ color: gradeTone }}
              >
                {gradeLabel}
              </span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
              Practice Arena · {modeLabel}
            </span>
            <h1 className="text-balance text-[clamp(1.5rem,2vw+0.5rem,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
              {correct} correct · {partial} partial · {wrong} wrong
            </h1>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Mean score {scorePct}%. German Gymnasium 1 (sehr gut) to 6
              (ungenügend) scale.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onReset}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
              >
                <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
                New session
              </button>
              <button
                type="button"
                onClick={onReset}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface-elevated px-4 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface"
              >
                <Pulse className="h-3.5 w-3.5" weight="duotone" />
                Run again
              </button>
              {canRetry && (
                <button
                  type="button"
                  onClick={() =>
                    onRetryWrong?.(wrongItems.map((i) => i.itemId))
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-accent-border/40 bg-accent-subtle/30 px-4 text-[12.5px] font-medium text-accent transition-colors hover:bg-accent-subtle/50"
                >
                  <ClockCounterClockwise className="h-3.5 w-3.5" weight="duotone" />
                  Retry wrong ({wrongItems.length})
                </button>
              )}
              <Link
                href="/tutor"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
              >
                <ChatCircleText className="h-3.5 w-3.5" weight="duotone" />
                Ask tutor about mistakes
              </Link>
            </div>
          </div>
        </div>
      </CockpitCard>

      {wrongItems.length > 0 && (
        <CockpitCard>
          <CockpitCardHeader label={`Review mistakes (${wrongItems.length})`} />
          <div className="flex flex-col gap-3">
            {wrongItems
              .sort((a, b) => a.order - b.order)
              .map((item) => (
                <SummaryItemRow key={item.itemId} item={item} />
              ))}
          </div>
        </CockpitCard>
      )}

      {augmentedItems
        .filter(
          (i) =>
            i.attempt?.verdict === "correct" &&
            !wrongItems.some((w) => w.itemId === i.itemId)
        )
        .sort((a, b) => a.order - b.order)
        .map((item) => (
          <SummaryItemRow key={item.itemId} item={item} />
        ))}
    </div>
  );
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  essay_analysis: "Essay",
  translation_drill: "Translation",
  formula_derivation: "Derivation",
  oral_recall: "Oral recall",
  user_text_answer: "Open prose",
  mcq: "Multiple choice",
  fill_blank: "Fill blank",
  step_problem: "Step problem",
  short_answer: "Short answer",
  worked_walkthrough: "Walkthrough",
};

function formatUserAnswer(answer: string, itemType: string): string {
  if (itemType === "oral_recall") {
    const selfCheckMatch = answer.match(/\[self-check:\s*(correct|struggled)\]/i);
    if (selfCheckMatch) {
      const label =
        selfCheckMatch[1] === "correct" ? "correct" : "struggled";
      const cleanAnswer = answer.replace(/\[self-check:\s*(correct|struggled)\]/gi, "").trim();
      return cleanAnswer
        ? `${cleanAnswer} [self-check: ${label}]`
        : `[self-check: ${label}]`;
    }
  }
  return answer;
}

function SummaryItemRow({
  item,
}: {
  readonly item: {
    readonly itemId: string;
    readonly order: number;
    readonly prompt: string;
    readonly skill: string;
    readonly type?: string;
    readonly attempt: {
      readonly verdict: "correct" | "partially_correct" | "incorrect";
      readonly score: number;
      readonly feedback: string;
      readonly betterAnswer: string;
      readonly userAnswer: string;
    } | null;
  };
}) {
  const typeLabel = item.type ? ITEM_TYPE_LABELS[item.type] ?? item.type : null;
  const verdict = item.attempt?.verdict ?? null;
  const verdictTone =
    verdict === "correct"
      ? "var(--subject-chemistry)"
      : verdict === "partially_correct"
        ? "var(--subject-german)"
        : "var(--subject-french)";
  const verdictLabel =
    verdict === "correct"
      ? "correct"
      : verdict === "partially_correct"
        ? "partial"
        : verdict === "incorrect"
          ? "wrong"
          : "no answer";
  const scorePct = item.attempt ? Math.round(item.attempt.score * 100) : 0;

  return (
    <CockpitCard>
      <CockpitCardHeader
        label={`Item ${item.order + 1}${typeLabel ? ` · ${typeLabel}` : ""}`}
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {item.skill}
          </span>
        }
      />
      <AIMarkdown
        id={`arena-summary-${item.itemId}`}
        content={item.prompt}
        density="bare"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">          <span
            className="inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{
              backgroundColor: `color-mix(in srgb, ${verdictTone} 12%, transparent)`,
              borderColor: `color-mix(in srgb, ${verdictTone} 36%, transparent)`,
              color: verdictTone,
            }}
          >
          {verdict ? (
            <CheckCircle className="mr-1 h-3 w-3" weight="bold" />
          ) : (
            <X className="mr-1 h-3 w-3" weight="bold" />
          )}
          {verdictLabel}
        </span>
        {item.attempt && (
          <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
            {scorePct}%
          </span>
        )}
      </div>

      {item.attempt && (
        <div className="mt-3 flex flex-col gap-3">
          {item.attempt.userAnswer && item.type === "oral_recall" && (
            <div className="rounded-lg border border-border bg-surface-elevated/40 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Your recall
              </p>
              <p className="mt-1 text-[12.5px] text-foreground/90">
                {formatUserAnswer(item.attempt.userAnswer, item.type)}
              </p>
            </div>
          )}
          <div className="rounded-lg border border-border bg-surface-elevated/40 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Feedback
            </p>
            <div className="mt-1">
              <AIMarkdown
                id={`arena-summary-${item.itemId}-feedback`}
                content={item.attempt.feedback}
                density="compact"
              />
            </div>
          </div>
          <div className="rounded-lg border border-accent-border/40 bg-accent-subtle/30 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              Stronger answer
            </p>
            <div className="mt-1">
              <AIMarkdown
                id={`arena-summary-${item.itemId}-better`}
                content={item.attempt.betterAnswer}
                density="compact"
              />
            </div>
          </div>
        </div>
      )}
    </CockpitCard>
  );
}

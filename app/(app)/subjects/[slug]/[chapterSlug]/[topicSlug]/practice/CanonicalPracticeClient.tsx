"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Preloaded,
  useMutation,
  usePreloadedQuery,
  useQuery,
} from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  CockpitCard,
  CockpitCardHeader,
} from "@/components/dashboard/CockpitCard";
import {
  ArrowLeft,
  ArrowRight,
  Books,
  ChatCircleText,
  Check,
  CheckCircle,
  CircleNotch,
  Pulse,
  Sparkle,
  WarningCircle,
  X,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { AIMarkdown } from "@/lib/content/aiMarkdown";
import {
  GERMAN_GRADE_LABELS,
  type GermanLetterGrade,
} from "@/lib/ai/prompts/grading";
import type { PracticeItemType } from "@/lib/ai/subjectBehaviors";

interface RunItem {
  readonly itemId: Id<"practiceItems">;
  readonly order: number;
  readonly type: PracticeItemType;
  readonly prompt: string;
  readonly options: readonly string[] | null;
  readonly expectedAnswer: string;
  readonly skill: string;
  readonly rubric: readonly string[];
  readonly attempt:
    | {
        readonly attemptId: Id<"practiceAttempts">;
        readonly userAnswer: string;
        readonly verdict: "correct" | "partially_correct" | "incorrect";
        readonly score: number;
        readonly feedback: string;
        readonly betterAnswer: string;
        readonly attemptedAt: number;
      }
    | null;
}

interface GradeResponse {
  readonly attemptId: Id<"practiceAttempts"> | null;
  readonly verdict: "correct" | "partially_correct" | "incorrect";
  readonly score: number;
  readonly feedback: string;
  readonly betterAnswer: string;
  readonly mistakeEntryId: Id<"mistakeEntries"> | null;
  readonly degraded?: boolean;
}

type Phase =
  | "loading"
  | "answering"
  | "grading"
  | "graded"
  | "finishing"
  | "summary"
  | "error";

export function CanonicalPracticeClient({
  preloaded,
  fallbackSubjectSlug,
  fallbackChapterSlug,
  fallbackTopicSlug,
}: {
  readonly preloaded: Preloaded<typeof api.subjects.getTopicDetailBySlug>;
  readonly fallbackSubjectSlug: string;
  readonly fallbackChapterSlug: string;
  readonly fallbackTopicSlug: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = searchParams.get("runId") as Id<"topicLessonPractice"> | null;

  const data = usePreloadedQuery(preloaded);

  const run = useQuery(
    api.practice.getLessonPracticeRun,
    runId ? { runId } : "skip"
  );
  const items = useQuery(
    api.practice.getLessonPracticeRunItems,
    runId ? { runId } : "skip"
  );

  const finishLessonPractice = useMutation(api.practice.finishLessonPractice);
  const abandonLessonPractice = useMutation(api.practice.abandonLessonPractice);

  const [phase, setPhase] = useState<Phase>("loading");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [grade, setGrade] = useState<GradeResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abandonInFlightRef = useRef(false);

  const subjectSlug = data?.subject.slug ?? fallbackSubjectSlug;
  const chapterSlug = data?.chapter.slug ?? fallbackChapterSlug;
  const topicSlugResolved = data?.topic.slug ?? fallbackTopicSlug;
  const topicTitle = data?.topic.title ?? fallbackTopicSlug;
  const topicHref = `/subjects/${subjectSlug}/${chapterSlug}/${topicSlugResolved}`;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!data) return;
    if (phase !== "loading") return;
    if (runId === null) {
      setPhase("error");
      setErrorMsg("Practice run id is missing — start a run from the topic page.");
      return;
    }
    if (run === undefined || items === undefined) return;
    if (!run) {
      setPhase("error");
      setErrorMsg("Practice run not found.");
      return;
    }
    if (run.status === "graded") {
      setPhase("summary");
      return;
    }
    setPhase("answering");
  }, [data, phase, run, items, runId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const orderedItems = useMemo(() => {
    if (!items) return [];
    return [...items].sort((a, b) => a.order - b.order);
  }, [items]);

  const total = orderedItems.length;
  const answeredCount = useMemo(
    () => orderedItems.filter((i) => i.attempt !== null).length,
    [orderedItems]
  );
  const progressPct = useMemo(
    () => (total > 0 ? (answeredCount / total) * 100 : 0),
    [total, answeredCount]
  );

  if (!data) {
    return (
      <NotFoundCard
        subjectSlug={subjectSlug}
        chapterSlug={chapterSlug}
        topicSlug={topicSlugResolved}
      />
    );
  }

  const onSubmit = async () => {
    if (!runId || !run || orderedItems.length === 0) return;
    const item = orderedItems[currentIndex];
    if (!item) return;
    const text = currentAnswer.trim();
    if (text.length === 0) {
      setErrorMsg("Please enter an answer before submitting.");
      return;
    }
    setPhase("grading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/topics/practice/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, itemId: item.itemId, userAnswer: text }),
      });
      const data = (await res.json()) as GradeResponse;
      if (!res.ok) {
        setErrorMsg(`Grader failed (${res.status}). Try again in a moment.`);
        setPhase("answering");
        return;
      }
      setGrade(data);
      setPhase("graded");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setPhase("answering");
    }
  };

  const onNext = () => {
    setGrade(null);
    setCurrentAnswer("");
    setErrorMsg(null);
    if (currentIndex + 1 < total) {
      setCurrentIndex((i) => i + 1);
      setPhase("answering");
    } else {
      void onFinish();
    }
  };

  const onFinish = async () => {
    if (!runId) return;
    setPhase("finishing");
    try {
      await finishLessonPractice({ runId });
      setPhase("summary");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Finish failed");
      setPhase("answering");
    }
  };

  const onAbandon = async () => {
    if (abandonInFlightRef.current) return;
    abandonInFlightRef.current = true;
    if (!runId) {
      router.push(topicHref);
      return;
    }
    try {
      await abandonLessonPractice({ runId });
    } catch {}
    router.push(topicHref);
  };

  if (phase === "loading") {
    return <SkeletonShell topicTitle={topicTitle} />;
  }

  if (phase === "error") {
    return (
      <ErrorCard
        message={errorMsg ?? "Practice run could not be loaded."}
        topicTitle={topicTitle}
        topicHref={topicHref}
      />
    );
  }

  if (phase === "summary" || run?.status === "graded") {
    return (
      <SummaryView
        topicTitle={topicTitle}
        topicHref={topicHref}
        subjectSlug={subjectSlug}
        topicSlug={topicSlugResolved}
        items={orderedItems}
        run={run ?? null}
      />
    );
  }

  const currentItem = orderedItems[currentIndex];
  if (!currentItem) {
    return (
      <PracticeShell
        topicTitle={topicTitle}
        progress={progressPct}
        total={total}
        answered={answeredCount}
        onAbandon={onAbandon}
      >
        <CockpitCard>
          <p className="text-[13px] leading-relaxed text-foreground">
            No more questions.
          </p>
        </CockpitCard>
      </PracticeShell>
    );
  }

  return (
    <PracticeShell
      topicTitle={topicTitle}
      progress={progressPct}
      total={total}
      answered={answeredCount}
      onAbandon={onAbandon}
    >
      {errorMsg && (
        <p className="rounded-lg border border-subject-french/30 bg-subject-french/10 px-3 py-2 text-[12px] text-subject-french">
          {errorMsg}
        </p>
      )}

      <CockpitCard>
        <CockpitCardHeader
          label={`Question ${currentIndex + 1} of ${total}`}
          trailing={
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              skill: {currentItem.skill}
            </span>
          }
        />
        <AIMarkdown
          id={`cp-${runId}-q${currentIndex}-prompt`}
          content={currentItem.prompt}
          density="bare"
        />

        <div className="mt-4 flex flex-col gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            {currentItem.type === "mcq" ? "Choose one" : "Your answer"}
          </span>
          <ItemInput
            item={currentItem}
            value={currentAnswer}
            setValue={setCurrentAnswer}
            disabled={phase !== "answering"}
          />
          {currentItem.type !== "mcq" && (
            <span className="text-[11.5px] text-muted-foreground">
              {currentAnswer.trim().length} characters
            </span>
          )}
        </div>
      </CockpitCard>

      {phase === "grading" && (
        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" />
          The tutor is reading your answer…
        </div>
      )}

      {grade && phase === "graded" && runId && (
        <GradeCard
          grade={grade}
          item={currentItem}
          idBase={`cp-${runId}-q${currentIndex}`}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onAbandon}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface"
        >
          <X className="h-3.5 w-3.5" weight="bold" />
          Abandon
        </button>

        {phase === "answering" && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={currentAnswer.trim().length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkle className="h-3.5 w-3.5" weight="duotone" />
            Submit answer
          </button>
        )}

        {phase === "graded" && (
          <button
            type="button"
            onClick={onNext}
            disabled={phase !== "graded"}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            {currentIndex + 1 < total ? (
              <>
                Next question
                <ArrowRight className="h-3.5 w-3.5" weight="bold" />
              </>
            ) : (
              <>
                Finish & view summary
                <CheckCircle className="h-3.5 w-3.5" weight="bold" />
              </>
            )}
          </button>
        )}
      </div>
    </PracticeShell>
  );
}

function ItemInput({
  item,
  value,
  setValue,
  disabled,
}: {
  readonly item: RunItem;
  readonly value: string;
  readonly setValue: (next: string) => void;
  readonly disabled: boolean;
}) {
  if (item.type === "mcq") {
    const options = item.options ?? [];
    return (
      <div className="flex flex-col gap-2">
        {options.length === 0 ? (
          <p className="text-[12px] text-subject-french">
            This MCQ has no options recorded — report the issue.
          </p>
        ) : (
          options.map((opt, i) => {
            const selected = value === opt;
            return (
              <button
                key={`${item.itemId}-${i}`}
                type="button"
                disabled={disabled}
                onClick={() => setValue(opt)}
                className={cn(
                  "flex h-auto min-h-[3rem] items-start gap-3 rounded-lg border border-border bg-background px-3.5 py-2.5 text-left text-[13px] leading-relaxed text-foreground transition-colors hover:border-foreground/40 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60",
                  selected &&
                    "border-accent bg-accent-subtle/40 text-foreground"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    selected ? "bg-accent text-accent-foreground" : "border border-border"
                  )}
                >
                  {selected ? (
                    <Check className="h-3 w-3" weight="bold" />
                  ) : (
                    <span className="font-mono text-[10px] tabular-nums">
                      {String.fromCharCode(65 + i)}
                    </span>
                  )}
                </span>
                <span>{opt}</span>
              </button>
            );
          })
        )}
      </div>
    );
  }

  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      disabled={disabled}
      rows={6}
      maxLength={2000}
      placeholder="Write a clear answer that references what the lesson said."
      className="min-h-[6rem] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40 disabled:opacity-60"
    />
  );
}

function PracticeShell({
  topicTitle,
  progress,
  total,
  answered,
  onAbandon,
  children,
}: {
  readonly topicTitle: string;
  readonly progress: number;
  readonly total: number;
  readonly answered: number;
  readonly onAbandon: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onAbandon}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated/60 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-accent-border/60 hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" weight="bold" />
          Topic
        </button>
        <span className="text-muted-foreground/50">/</span>
        <span className="rounded-full bg-accent-subtle/40 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
          Baseline practice — {topicTitle}
        </span>
      </nav>

      <header className="flex flex-col gap-3">
        <h1 className="text-balance text-[clamp(1.5rem,2vw+0.5rem,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          Baseline practice
        </h1>
        {total > 0 && (
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-full max-w-[26rem] overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${Math.max(2, Math.round(progress))}%` }}
              />
            </div>
            <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
              {answered} / {total}
            </span>
          </div>
        )}
        <p className="text-[12.5px] text-muted-foreground">
          Answer the canonical questions against your topic. The tutor
          grades each one and writes a stronger version below your answer.
          You can{" "}
          <button
            type="button"
            onClick={onAbandon}
            className="underline underline-offset-2 transition-colors hover:text-foreground"
          >
            abandon
          </button>{" "}
          the run at any point; in-progress items stay scored.
        </p>
      </header>

      {children}
    </div>
  );
}

function GradeCard({
  grade,
  item,
  idBase,
}: {
  readonly grade: GradeResponse;
  readonly item: RunItem;
  readonly idBase: string;
}) {
  const verdictColor =
    grade.verdict === "correct"
      ? "var(--subject-chemistry)"
      : grade.verdict === "partially_correct"
        ? "var(--subject-german)"
        : "var(--subject-french)";
  const verdictLabel =
    grade.verdict === "correct"
      ? "correct"
      : grade.verdict === "partially_correct"
        ? "partially correct"
        : "incorrect";
  const scorePct = Math.round(grade.score * 100);

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Grader"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            score {scorePct}%
          </span>
        }
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{
              backgroundColor: `color-mix(in srgb, ${verdictColor} 12%, transparent)`,
              borderColor: `color-mix(in srgb, ${verdictColor} 36%, transparent)`,
              color: verdictColor,
            }}
          >
            {verdictLabel}
          </span>
          {grade.degraded && (
            <span className="inline-flex items-center gap-1 rounded-full border border-subject-french/40 bg-subject-french/10 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-subject-french">
              <WarningCircle className="h-3 w-3" weight="bold" />
              fallback
            </span>
          )}
        </div>

        <AIMarkdown
          id={`${idBase}-feedback`}
          content={grade.feedback}
          density="compact"
        />

        <div className="rounded-lg border border-accent-border/40 bg-accent-subtle/30 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
            Stronger answer
          </p>
          <div className="mt-1">
            <AIMarkdown
              id={`${idBase}-better`}
              content={grade.betterAnswer}
              density="compact"
            />
          </div>
        </div>

        {item.rubric.length > 0 && (
          <details className="rounded-lg border border-border bg-surface-elevated/40 px-3 py-2">
            <summary className="cursor-pointer text-[11.5px] font-medium text-muted-foreground">
              Show rubric
            </summary>
            <ul className="mt-2 list-disc pl-4 text-[12px] text-foreground/90">
              {item.rubric.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </CockpitCard>
  );
}

function SummaryView({
  topicTitle,
  topicHref,
  subjectSlug,
  topicSlug,
  items,
  run,
}: {
  readonly topicTitle: string;
  readonly topicHref: string;
  readonly subjectSlug: string;
  readonly topicSlug: string;
  readonly items: readonly RunItem[];
  readonly run:
    | {
        readonly itemCount: number;
        readonly answeredCount: number;
        readonly overallScore: number | null;
        readonly grade: "1" | "2" | "3" | "4" | "5" | "6" | null;
        readonly startedAt: number;
        readonly completedAt: number | null;
      }
    | null;
}) {
  const grade: GermanLetterGrade = run?.grade ?? "6";
  const gradeLabel = GERMAN_GRADE_LABELS[grade].label;
  const scorePct = Math.round((run?.overallScore ?? 0) * 100);
  const correct = items.filter((i) => i.attempt?.verdict === "correct").length;
  const partial = items.filter(
    (i) => i.attempt?.verdict === "partially_correct"
  ).length;
  const wrong = items.filter((i) => i.attempt?.verdict === "incorrect").length;
  const gradeTone =
    grade === "1" || grade === "2"
      ? "var(--subject-chemistry)"
      : grade === "3"
        ? "var(--subject-german)"
        : "var(--subject-french)";

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <CockpitCard>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
          <div
            className="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-2xl border"
            style={{
              backgroundColor: `color-mix(in srgb, ${gradeTone} 12%, transparent)`,
              borderColor: `color-mix(in srgb, ${gradeTone} 40%, transparent)`,
            }}
          >
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
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
              {topicTitle}
            </span>
            <h1 className="text-balance text-[clamp(1.5rem,2vw+0.5rem,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
              {correct} correct · {partial} partial · {wrong} wrong
            </h1>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Mean score {scorePct}%. The grade is the German Gymnasium
              1 (sehr gut) to 6 (ungenügend) scale, derived from the per-item
              mean.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link
                href={topicHref}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
              >
                <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
                Back to topic
              </Link>
              <Link
                href={`${topicHref}/practice`}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface"
                title="Start a fresh run of the same canonical set"
              >
                <Pulse className="h-3.5 w-3.5" weight="duotone" />
                Run again
              </Link>
              <Link
                href={`/tutor?subject=${encodeURIComponent(subjectSlug)}&topic=${encodeURIComponent(topicSlug)}&from=${encodeURIComponent(`${topicHref}/practice`)}`}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-accent/90"
              >
                <ChatCircleText className="h-3.5 w-3.5" weight="duotone" />
                Ask tutor about this
              </Link>
            </div>
          </div>
        </div>
      </CockpitCard>

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <SummaryItemRow
            key={item.itemId}
            item={item}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryItemRow({
  item,
}: {
  readonly item: RunItem;
}) {
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
        label={`Item ${item.order + 1}`}
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            skill: {item.skill}
          </span>
        }
      />
      <AIMarkdown
        id={`summary-${item.itemId}-prompt`}
        content={item.prompt}
        density="bare"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em]"
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
          <div className="rounded-lg border border-border bg-surface-elevated/40 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Feedback
            </p>
            <div className="mt-1">
              <AIMarkdown
                id={`summary-${item.itemId}-feedback`}
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
                id={`summary-${item.itemId}-better`}
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

function SkeletonShell({ topicTitle }: { readonly topicTitle: string }) {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <CockpitCard>
        <div className="flex flex-col gap-2 py-2">
          <div className="h-4 w-40 animate-pulse rounded bg-muted/40" />
          <div className="h-3 w-64 animate-pulse rounded bg-muted/30" />
        </div>
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          Loading practice for {topicTitle}…
        </p>
      </CockpitCard>
    </div>
  );
}

function NotFoundCard({
  subjectSlug,
  chapterSlug,
  topicSlug,
}: {
  readonly subjectSlug: string;
  readonly chapterSlug: string;
  readonly topicSlug: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-[var(--shadow-soft)]">
        <div className="rounded-xl bg-background p-7 text-center sm:p-8">
          <span
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--subject-french) 12%, transparent)",
              color: "var(--subject-french)",
            }}
            aria-hidden
          >
            <Books className="h-5 w-5" weight="duotone" />
          </span>
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            Topic not found
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            <span className="font-mono">{subjectSlug}</span> /{" "}
            <span className="font-mono">{chapterSlug}</span> /{" "}
            <span className="font-mono">{topicSlug}</span> does not match a
            topic in the curriculum.
          </p>
          <Link
            href={`/subjects/${subjectSlug}/${chapterSlug}`}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to chapter
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorCard({
  message,
  topicTitle,
  topicHref,
}: {
  readonly message: string;
  readonly topicTitle: string;
  readonly topicHref: string;
}) {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5">
        <Link
          href={topicHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated/60 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-accent-border/60 hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" weight="bold" />
          Topic
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="rounded-full bg-subject-french/15 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-subject-french">
          Practice error — {topicTitle}
        </span>
      </nav>
      <CockpitCard>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-subject-french/15 text-subject-french"
            aria-hidden
          >
            <WarningCircle className="h-5 w-5" weight="duotone" />
          </span>
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            Could not start practice
          </h2>
          <p className="max-w-md text-[12.5px] text-muted-foreground">
            {message}
          </p>
          <Link
            href={topicHref}
            className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to topic
          </Link>
        </div>
      </CockpitCard>
    </div>
  );
}

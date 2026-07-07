"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  CockpitCard,
  CockpitCardHeader,
} from "@/components/dashboard/CockpitCard";
import {
  ArrowRight,
  ChatCircleText,
  CheckCircle,
  CircleNotch,
  Pulse,
  Sparkle,
  WarningCircle,
  X,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { AIMarkdown } from "@/lib/content/aiMarkdown";

interface GradeResponse {
  readonly attemptId: Id<"practiceAttempts"> | null;
  readonly verdict: "correct" | "partially_correct" | "incorrect";
  readonly score: number;
  readonly feedback: string;
  readonly betterAnswer: string;
  readonly mistakeEntryId: Id<"mistakeEntries"> | null;
  readonly degraded?: boolean;
}

type Phase = "starting" | "answering" | "grading" | "graded" | "finishing" | "error";

/**
 * PracticeClient.
 *
 * Lesson practice page state machine per plan §6.4:
 *   idle → submit-pending → grade-shown → (next | finish)
 *
 * Resolves the topic via `getOwnedTopicBySlug` (server-
 * side ownership check via Clerk). Generates the run via
 * `/api/topics/practice/start` (AI + commit), then
 * grades each item via `/api/topics/practice/grade`.
 */
export function PracticeClient({
  topicSlug,
}: {
  readonly topicSlug: string;
}) {
  const router = useRouter();
  const topic = useQuery(api.topics.getOwnedTopicBySlug, { slug: topicSlug });

  const [phase, setPhase] = useState<Phase>("starting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [runId, setRunId] = useState<Id<"topicLessonPractice"> | null>(null);
  const [itemIds, setItemIds] = useState<Id<"practiceItems">[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [grade, setGrade] = useState<GradeResponse | null>(null);

  const items = useQuery(
    api.practice.getLessonPracticeRunItems,
    runId ? { runId } : "skip"
  );

  // Note: `submitAnswerAndGrade` is invoked by the route
  // handler at `/api/topics/practice/grade` after the AI
  // grade lands. The client does not call the mutation
  // directly — doing so would race the route handler's
  // own write and could double-insert. Only `finish`
  // and `abandon` are client-driven mutations.
  const finishLessonPractice = useMutation(
    api.practice.finishLessonPractice
  );
  const abandonLessonPractice = useMutation(
    api.practice.abandonLessonPractice
  );

  // Start a fresh run when the topic + its lesson are
  // known. `topic?.latestLesson!.id` is only consumed
  // after the optional-chaining guard, so the type is
  // narrowed correctly.
  useEffect(() => {
    if (!topic || !topic.latestLesson) return;
    const lessonId = topic.latestLesson.id;
    let aborted = false;
    void (async () => {
      try {
        const res = await fetch("/api/topics/practice/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId,
            itemCount: 5,
          }),
        });
        if (aborted) return;
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          setErrorMsg(
            res.status === 422
              ? "The tutor could not generate practice items for this lesson. Try Regenerate from the lesson page with a clearer brief, then return here."
              : `Practice start failed (${res.status}). ${text}`.trim()
          );
          setPhase("error");
          return;
        }
        const data = (await res.json()) as {
          runId: Id<"topicLessonPractice">;
          itemIds: Id<"practiceItems">[];
        };
        setRunId(data.runId);
        setItemIds(data.itemIds);
        setPhase("answering");
      } catch (err) {
        if (!aborted) {
          setErrorMsg((err as Error).message ?? "Network error");
          setPhase("error");
        }
      }
    })();
    return () => {
      aborted = true;
    };
    // Re-fire only when the latest lesson *id* changes, not
    // on every `topic` update (mastery ticks, lastActivity
    // bumps). The full `topic` is intentionally not in the
    // dep array — the body's optional-chain guard already
    // narrows on the latest-lesson shape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.latestLesson?.id]);

  const onSubmit = async () => {
    if (!runId || !items) return;
    const item = items[currentIndex];
    if (!item) return;
    const text = currentAnswer.trim();
    if (text.length === 0) {
      setErrorMsg("Please write an answer before submitting.");
      return;
    }
    setPhase("grading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/topics/practice/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          itemId: item.itemId,
          userAnswer: text,
        }),
      });
      // Apply the mutation locally so the practice page
      // reflects the grade immediately even if the route
      // handler returns a degraded shape. The route
      // handler is the source of truth — we surface its
      // payload.
      const data = (await res.json()) as GradeResponse;
      if (!res.ok) {
        setErrorMsg("Grader failed. Try again in a moment.");
        setPhase("error");
        return;
      }
      setGrade(data);
      // The mutation has already been invoked by the
      // route handler; nothing to do here on the
      // persistence side.
      setPhase("graded");
    } catch (err) {
      setErrorMsg((err as Error).message ?? "Network error");
      setPhase("error");
    }
  };

  const onNext = () => {
    setGrade(null);
    setCurrentAnswer("");
    setErrorMsg(null);
    if (currentIndex + 1 < itemIds.length) {
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
    } catch (err) {
      setErrorMsg((err as Error).message ?? "Finish failed");
      setPhase("error");
      return;
    }
    router.push(`/my-topics/${topicSlug}/practice/results`);
  };

  // Single-flight guard for `onAbandon`. Two rapid clicks
  // (or a sticky double-tap on touch) would otherwise enqueue
  // two `abandonLessonPractice` calls; while the mutation
  // is idempotent on the `status` field, the second call's
  // `ConvexError("run_not_in_progress")` would still print
  // a noisy warning to the console. The ref latches the
  // first invocation; subsequent clicks are a no-op until
  // navigation fires.
  const abandonInFlightRef = useRef(false);
  const onAbandon = async () => {
    if (abandonInFlightRef.current) return;
    abandonInFlightRef.current = true;
    if (!runId) {
      router.push(`/my-topics/${topicSlug}/lesson`);
      return;
    }
    try {
      await abandonLessonPractice({ runId });
    } catch (err) {
      console.warn("abandonLessonPractice failed:", err);
    }
    router.push(`/my-topics/${topicSlug}/lesson`);
  };

  const total = itemIds.length;
  const answeredCount = currentIndex + (phase === "graded" ? 1 : 0);
  const progressPct = useMemo(
    () => (total > 0 ? (answeredCount / total) * 100 : 0),
    [total, answeredCount]
  );

  if (topic === undefined) {
    return <SkeletonShell topicTitle="…" />;
  }

  if (!topic) {
    return <NoTopic topicSlug={topicSlug} />;
  }

  if (!topic.latestLesson) {
    return <NoLesson topicTitle={topic.title} onAbandon={onAbandon} />;
  }

  if (phase === "error" && !runId) {
    return (
      <PracticeShell
        topicTitle={topic.title}
        progress={0}
        total={0}
        onAbandon={onAbandon}
      >
        <p className="rounded-lg border border-subject-french/30 bg-subject-french/10 px-3 py-2 text-[12px] leading-relaxed text-subject-french">
          <WarningCircle className="mr-1 inline h-3.5 w-3.5" weight="bold" />
          {errorMsg ?? "Something went wrong starting the practice run."}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setPhase("starting");
              setErrorMsg(null);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            <Pulse className="h-3.5 w-3.5" weight="duotone" />
            Retry
          </button>
          <button
            type="button"
            onClick={() => router.push(`/my-topics/${topicSlug}/lesson`)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-4 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface"
          >
            Back to lesson
          </button>
        </div>
      </PracticeShell>
    );
  }

  if (phase === "starting") {
    return (
      <PracticeShell
        topicTitle={topic.title}
        progress={0}
        total={0}
        onAbandon={onAbandon}
      >
        <CockpitCard>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle/60 text-accent"
              aria-hidden
            >
              <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
            </span>
            <p className="text-[13.5px] font-medium text-foreground">
              Generating practice questions…
            </p>
            <p className="max-w-md text-[12.5px] text-muted-foreground">
              The tutor is writing 5 open-prose questions grounded in
              the lesson. This usually takes 2–4 seconds.
            </p>
          </div>
        </CockpitCard>
      </PracticeShell>
    );
  }

  if (!items) {
    return (
      <PracticeShell
        topicTitle={topic.title}
        progress={progressPct}
        total={total}
        onAbandon={onAbandon}
      >
        <CockpitCard>
          <div className="flex animate-pulse flex-col gap-3 py-8 text-center">
            <div className="mx-auto h-12 w-3/4 rounded bg-muted/30" />
            <div className="mx-auto h-4 w-1/2 rounded bg-muted/30" />
          </div>
        </CockpitCard>
      </PracticeShell>
    );
  }

  const currentItem = items[currentIndex];
  if (!currentItem) {
    return (
      <PracticeShell
        topicTitle={topic.title}
        progress={progressPct}
        total={total}
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
      topicTitle={topic.title}
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
        {/* The question prompt is model-authored, so it
            goes through AIMarkdown at bare density. The
            tight density sits cleanly inside the
            CockpitCard padding without the leading
            margins the prose density adds. The `id` ties
            the per-block memoization keys to the run +
            current item index, which is stable across the
            grading round-trip on the same item. */}
        <AIMarkdown
          // Same `runId` + `currentIndex` key formula as
          // the grade card (calibrated so the per-block
          // memoization keys align across the question →
          // submit → grade transition).
          id={`practice-${runId}-q${currentIndex}-prompt`}
          content={currentItem.prompt}
          density="bare"
        />

        <div className="mt-4 flex flex-col gap-2">
          <label
            htmlFor="practice-answer"
            className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground"
          >
            Your answer
          </label>
          <textarea
            id="practice-answer"
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            disabled={phase !== "answering"}
            rows={8}
            maxLength={8000}
            placeholder="Write a few sentences that connect what the lesson said to your own reasoning."
            className="min-h-[8rem] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
          <span className="text-[11.5px] text-muted-foreground">
            {currentAnswer.trim().length} characters
          </span>
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
          // `idBase` is the AIMarkdown id prefix for every
          // block in this grade response. Building it once
          // here (the only place both `runId` and
          // `currentIndex` are in scope) keeps `GradeCard`'s
          // signature focused on the render shape — it
          // doesn't need to know about Convex ids at all.
          idBase={`practice-${runId}-q${currentIndex}`}
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
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            )}
          >
            <Sparkle className="h-3.5 w-3.5" weight="duotone" />
            Submit answer
          </button>
        )}

        {phase === "graded" && (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            {currentIndex + 1 < total ? (
              <>
                Next question
                <ArrowRight className="h-3.5 w-3.5" weight="bold" />
              </>
            ) : (
              <>
                Finish & view results
                <CheckCircle className="h-3.5 w-3.5" weight="bold" />
              </>
            )}
          </button>
        )}
      </div>
    </PracticeShell>
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
  readonly answered?: number;
  readonly onAbandon: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5"
      >
        <Link
          href="/my-topics"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated/60 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm transition-colors hover:border-accent-border/60 hover:text-foreground"
        >
          Your topics
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="rounded-full bg-accent-subtle/40 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
          Practice — {topicTitle}
        </span>
      </nav>

      <header className="flex flex-col gap-3">
        <h1 className="text-balance text-[clamp(1.5rem,2vw+0.5rem,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          Practice run
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
              {answered ?? 0} / {total}
            </span>
          </div>
        )}
        <p className="text-[12.5px] text-muted-foreground">
          Answer in prose. The tutor will grade each answer and write
          a stronger version below it. You can{" "}
          <button
            type="button"
            onClick={onAbandon}
            className="underline underline-offset-2 transition-colors hover:text-foreground"
          >
            abandon
          </button>{" "}
          the run at any point without losing the items that already
          landed.
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
  readonly item: {
    readonly prompt: string;
    readonly expectedAnswer: string;
    readonly rubric: readonly string[];
  };
  /**
   * Stable id prefix for every AIMarkdown block in the
   * grade card. Derived from `runId` + `currentIndex` in
   * the parent so the GradeCard itself is unaware of
   * Convex types — the card stays a pure presentational
   * component.
   */
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
        {/* Both feedback and the model-authored strong
            answer can carry LaTeX math. Compact density
            keeps the line-height tight inside the
            GradeCard panel. `id` keys are stable for the
            lifetime of the grade response — the grade
            object is set once per submit and keeps the
            same shape across the Next button transition. */}
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

        <details className="rounded-lg border border-border bg-surface-elevated/40 px-3 py-2">
          <summary className="cursor-pointer text-[11.5px] font-medium text-muted-foreground">
            Show rubric + model answer
          </summary>
          <div className="mt-2 flex flex-col gap-2 text-[12px] text-foreground/90">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Rubric
              </p>
              <ul className="mt-1 list-disc pl-4">
                {item.rubric.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Expected answer
              </p>
              <div className="mt-1">
                <AIMarkdown
                  id={`${idBase}-expected`}
                  content={item.expectedAnswer}
                  density="compact"
                />
              </div>
            </div>
          </div>
        </details>

        <p className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
          <ChatCircleText className="h-3 w-3" weight="duotone" />
          After the run finishes, the results page links straight to
          the tutor with this run as context.
        </p>
      </div>
    </CockpitCard>
  );
}

function SkeletonShell({ topicTitle }: { readonly topicTitle: string }) {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <CockpitCard>
        <div className="flex animate-pulse flex-col gap-2 py-2">
          <div className="h-4 w-40 rounded bg-muted/40" />
          <div className="h-3 w-64 rounded bg-muted/30" />
        </div>
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          Loading {topicTitle}…
        </p>
      </CockpitCard>
    </div>
  );
}

function NoTopic({ topicSlug }: { readonly topicSlug: string }) {
  return (
    <Link
      href="/my-topics"
      className="block rounded-xl border border-border bg-surface-elevated/40 p-4 text-[12.5px] text-muted-foreground transition-colors hover:bg-surface-elevated"
    >
      No topic matches <span className="font-mono">{topicSlug}</span>{" "}
      in your account — back to your topics →
    </Link>
  );
}

function NoLesson({
  topicTitle,
  onAbandon,
}: {
  readonly topicTitle: string;
  readonly onAbandon: () => void;
}) {
  return (
    <CockpitCard>
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-[13.5px] font-medium text-foreground">
          {topicTitle} has no lesson yet.
        </p>
        <p className="max-w-md text-[12.5px] text-muted-foreground">
          Practice needs a generated lesson. Head back to the lesson
          page and add one.
        </p>
        <button
          type="button"
          onClick={onAbandon}
          className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
        >
          Back to lesson
        </button>
      </div>
    </CockpitCard>
  );
}


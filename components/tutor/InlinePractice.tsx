"use client";

/**
 * InlinePractice.tsx — Phase 3 §5.2.
 *
 * The inline tutor practice runner. Renders inside the
 * chat surface next to the message the user was reading
 * when they tapped "Generate 3 quick questions".
 *
 * The runner is dumb — it subscribes to
 * `api.tutorPractice.getInlineSessionForRunner` for the
 * items + each item's latest attempt, and POSTs to
 * `/api/tutor/practice/grade` for on-the-spot grading
 * after each submission.
 *
 * UX model:
 *   - One question visible at a time (a `currentItemIdx`
 *     controlled internally).
 *   - A `<textarea>` captures the answer; submit via the
 *     action button (Cmd/Ctrl+Enter is a follow-up we
 *     can add later — out of scope for Phase 3).
 *   - After grading, the verdict + feedback + better
 *     answer surface inline. A "Next question" button
 *     advances `currentItemIdx`.
 *   - When every item has an attempt, the runner shows
 *     the aggregate score + German letter grade + a
 *     "Try another 3" + "Close" affordance.
 *
 * Persistence: per-item graded state lives in the
 * standard `practiceAttempts` rows, so the inline
 * practice NATIVELY feeds the mastery curve. No
 * bespoke mastery wiring needed.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  NotePencil,
  Sparkle,
  WarningCircle,
  X,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils/cn";

const LANGUAGE_FOR_GRADER = "de";

export function InlinePractice({
  sessionId,
  subjectColor,
  onClose,
}: {
  /** The inline session to render. */
  readonly sessionId: Id<"inlineTutorSessions">;
  /** The subject color used for the topic-tone accents. */
  readonly subjectColor?: string;
  /** Optional close action — fired when the user collapses the runner. */
  readonly onClose?: () => void;
}) {
  const sessionData = useQuery(
    api.tutorPractice.getInlineSessionForRunner,
    { sessionId }
  );
  const endSession = useMutation(api.tutorPractice.endInlineSession);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [submittingItemId, setSubmittingItemId] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  // Guard against re-entry: when `endSession` is in
  // flight we must not start a second one, even if a
  // parent re-render re-runs the effect on the same
  // frame. The mutation is idempotent at the row level
  // (re-patches same values) but a second round-trip +
  // a second telemetry emit is wasted work.
  const endSessionStartedRef = useRef(false);

  const totalItems = sessionData?.items.length ?? 0;
  const completedAt = sessionData?.session.completedAt ?? null;

  // Memoize answered-count off the ITEMS REFERENCE so
  // the footer does NOT toggle on every keystroke or
  // every sessionData object re-allocation. The items
  // array is stable across re-renders when nothing has
  // changed (Convex returns the same array reference on
  // identity-equal queries).
  const answeredCount = useMemo(
    () => sessionData?.items.filter((i) => i.attempt !== null).length ?? 0,
    [sessionData?.items]
  );

  // Once every item is answered, lock the runner into
  // the "summary" view and end the session (idempotent).
  // We deliberately depend only on the primitive
  // derived values — not on `sessionData` itself —
  // because Convex returns a fresh object reference on
  // every re-render. Otherwise this effect would fire
  // after every keystroke in the textarea once the
  // user has finished, flooding the mutation API + the
  // `aiGenerations` telemetry log.
  useEffect(() => {
    if (completedAt !== null) return;
    if (totalItems === 0) return;
    if (answeredCount !== totalItems) return;
    if (endSessionStartedRef.current) return;
    endSessionStartedRef.current = true;
    void endSession({ sessionId })
      .catch((err) => {
        // Reset so the next attempted end actually
        // runs (otherwise a transient network blip
        // leaves the session permanently un-closed).
        endSessionStartedRef.current = false;
        console.error("[inline-practice] endSession failed", err);
      });
  }, [answeredCount, totalItems, completedAt, sessionId, endSession]);

  if (sessionData === undefined) {
    return <RunnerSkeleton subjectColor={subjectColor} />;
  }
  if (sessionData === null) {
    return (
      <RunnerCard subjectColor={subjectColor}>
        <p className="text-[12.5px] text-muted-foreground">
          This practice session is no longer available.
        </p>
      </RunnerCard>
    );
  }

  const item = sessionData.items[currentIdx];
  const allDone = answeredCount === totalItems && totalItems > 0;

  // Initialize any unanswered item to "" so the textarea
  // is always controlled.
  const draftForItem = item ? (draftAnswers[item.itemId] ?? "") : "";

  const submit = async (itemId: string, answer: string) => {
    setGradeError(null);
    setSubmittingItemId(itemId);
    try {
      const res = await fetch("/api/tutor/practice/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          itemId,
          userAnswer: answer,
          language: LANGUAGE_FOR_GRADER,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Grader failed (${res.status}): ${body}`);
      }
      await res.json(); // The query re-subscribes; we don't
                        // need to use the response object.
                        // We rely on Convex reactivity to
                        // re-fetch the session and surface
                        // the new attempt below.
    } catch (err) {
      console.error("[inline-practice] grade submit failed", err);
      setGradeError(
        err instanceof Error ? err.message : "Could not grade this answer."
      );
    } finally {
      setSubmittingItemId(null);
    }
  };

  const onNext = () => {
    setCurrentIdx((idx) => Math.min(idx + 1, totalItems - 1));
  };

  const onPrev = () => {
    setCurrentIdx((idx) => Math.max(idx - 1, 0));
  };

  return (
    <RunnerCard subjectColor={subjectColor}>
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <NotePencil
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 text-accent"
            weight="duotone"
          />
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Quick practice
            </span>
            <span className="text-[12px] text-foreground/90">
              {answeredCount}/{totalItems} answered
              {allDone ? " · summary" : ""}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onClose?.()}
          aria-label="Close quick practice"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
        >
          <X className="h-3 w-3" weight="bold" />
        </button>
      </header>

      {allDone && sessionData.session.overallScore !== null ? (
        <SummaryView
          correct={sessionData.items.filter(
            (i) => i.attempt?.verdict === "correct"
          ).length}
          total={totalItems}
          score={sessionData.session.overallScore}
          grade={sessionData.session.grade}
        />
      ) : item ? (
        <ItemView
          order={currentIdx + 1}
          total={totalItems}
          prompt={item.prompt}
          skill={item.skill}
          draft={draftForItem}
          setDraft={(next) =>
            setDraftAnswers((prev) => ({
              ...prev,
              [item.itemId]: next,
            }))
          }
          attempt={item.attempt}
          gradedBefore={item.attempt !== null}
          submitting={submittingItemId === item.itemId}
          gradeError={gradeError}
          onPrev={currentIdx > 0 ? onPrev : null}
          onNext={
            answeredCount > currentIdx && currentIdx < totalItems - 1
              ? onNext
              : null
          }
          onSubmit={() => {
            void submit(item.itemId, draftForItem);
          }}
        />
      ) : null}
    </RunnerCard>
  );
}

// ── Sub-components ───────────────────────────────────

function RunnerCard({
  subjectColor,
  children,
}: {
  readonly subjectColor?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <aside
      role="region"
      aria-label="Inline tutor practice"
      className="mx-auto my-3 flex w-full max-w-[42rem] flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-3.5 shadow-[var(--shadow-soft)]"
      style={
        subjectColor
          ? ({
              borderColor: `color-mix(in srgb, ${subjectColor} 30%, var(--border))`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </aside>
  );
}

function RunnerSkeleton({ subjectColor }: { readonly subjectColor?: string }) {
  return (
    <RunnerCard subjectColor={subjectColor}>
      <div className="flex animate-pulse flex-col gap-2">
        <div className="h-5 w-32 rounded-full bg-muted/30" />
        <div className="h-3 w-48 rounded-full bg-muted/20" />
        <div className="mt-2 h-16 rounded-lg bg-muted/15" />
      </div>
    </RunnerCard>
  );
}

function ItemView({
  order,
  total,
  prompt,
  skill,
  draft,
  setDraft,
  attempt,
  gradedBefore,
  submitting,
  gradeError,
  onPrev,
  onNext,
  onSubmit,
}: {
  readonly order: number;
  readonly total: number;
  readonly prompt: string;
  readonly skill: string;
  readonly draft: string;
  readonly setDraft: (next: string) => void;
  readonly attempt:
    | {
        readonly verdict: "correct" | "partially_correct" | "incorrect";
        readonly score: number;
        readonly feedback: string;
        readonly betterAnswer: string;
        readonly userAnswer: string;
      }
    | null;
  readonly gradedBefore: boolean;
  readonly submitting: boolean;
  readonly gradeError: string | null;
  readonly onPrev: (() => void) | null;
  readonly onNext: (() => void) | null;
  readonly onSubmit: () => void;
}) {
  const canSubmit = draft.trim().length > 0 && !submitting;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          Question {order} of {total}
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          {skill}
        </span>
      </div>
      <p className="text-[13.5px] leading-relaxed text-foreground">
        {prompt}
      </p>
      <label className="flex flex-col gap-1.5 text-[11px] font-medium text-muted-foreground">
        Your answer
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="Write your answer in 1-4 sentences."
          className="min-h-[5rem] resize-y rounded-md border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40 transition-colors"
        />
      </label>

      {gradeError && (
        <p
          role="alert"
          className="flex items-center gap-1.5 rounded-md border border-subject-french/30 bg-subject-french/10 px-2.5 py-1.5 text-[11.5px] text-subject-french"
        >
          <WarningCircle className="h-3 w-3" weight="duotone" />
          {gradeError}
        </p>
      )}

      {attempt ? (
        <VerdictPane
          verdict={attempt.verdict}
          score={attempt.score}
          feedback={attempt.feedback}
          betterAnswer={attempt.betterAnswer}
        />
      ) : null}

      {!gradedBefore && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onPrev ?? (() => {})}
            disabled={!onPrev}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-3 w-3" weight="bold" />
            Previous
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              canSubmit
                ? "bg-accent text-accent-foreground hover:bg-accent/90"
                : "bg-surface text-muted-foreground"
            )}
          >
            {submitting ? (
              <>
                <Sparkle
                  className="h-3 w-3 animate-pulse"
                  weight="duotone"
                />
                Grading…
              </>
            ) : (
              <>
                Submit
                <ArrowRight className="h-3 w-3" weight="bold" />
              </>
            )}
          </button>
        </div>
      )}

      {attempt && onNext && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onNext}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[11.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            Next question
            <ArrowRight className="h-3 w-3" weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}

function VerdictPane({
  verdict,
  score,
  feedback,
  betterAnswer,
}: {
  readonly verdict: "correct" | "partially_correct" | "incorrect";
  readonly score: number;
  readonly feedback: string;
  readonly betterAnswer: string;
}) {
  const tone =
    verdict === "correct"
      ? "var(--subject-chemistry)"
      : verdict === "partially_correct"
        ? "var(--subject-german)"
        : "var(--subject-french)";
  const verdictLabel =
    verdict === "correct"
      ? "Got it"
      : verdict === "partially_correct"
        ? "Partly there"
        : "Not quite";
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border px-3 py-2.5"
      style={{
        backgroundColor: `color-mix(in srgb, ${tone} 10%, var(--surface))`,
        borderColor: `color-mix(in srgb, ${tone} 30%, var(--border))`,
      }}
    >
      <div className="flex items-center justify-between text-[11.5px] font-medium uppercase tracking-[0.14em]">
        <span className="flex items-center gap-1.5" style={{ color: tone }}>
          <CheckCircle className="h-3.5 w-3.5" weight="duotone" />
          {verdictLabel}
        </span>
        <span className="font-mono text-muted-foreground">
          {Math.round(score * 100)}%
        </span>
      </div>
      <p className="text-[12px] leading-relaxed text-foreground/90">
        {feedback}
      </p>
      <div className="flex flex-col gap-1 rounded-md bg-background/60 px-2.5 py-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Stronger answer
        </span>
        <p className="text-[12px] leading-relaxed text-foreground/95">
          {betterAnswer}
        </p>
      </div>
    </div>
  );
}

function SummaryView({
  correct,
  total,
  score,
  grade,
}: {
  readonly correct: number;
  readonly total: number;
  readonly score: number;
  readonly grade: "1" | "2" | "3" | "4" | "5" | "6" | null;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
      <p className="text-[12.5px] leading-relaxed text-foreground">
        You answered{" "}
        <span className="font-semibold">
          {correct}/{total}
        </span>{" "}
        correctly.{" "}
        <span className="text-muted-foreground">
          Inline totals feed your topic mastery curve.
        </span>
      </p>
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Mean score
          </span>
          <span className="font-mono text-[14px] tabular-nums text-foreground">
            {Math.round(score * 100)}%
          </span>
        </div>
        {grade && (
          <div className="flex flex-col">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              German grade
            </span>
            <span className="font-mono text-[14px] tabular-nums text-foreground">
              {grade}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

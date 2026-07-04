"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowLeft,
  Books,
  CheckCircle,
  ChatCircleText,
  Sparkle,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { resolveColorVar } from "@/lib/utils/subjectColor";

/**
 * TutorHeader.
 *
 * The top band of /tutor. Carries the breadcrumb chain
 * (subjects / subject / chapter), the subject color band,
 * the topic title, a small session-state badge, and the
 * "End session" CTA.
 *
 * When `sessionId` is null (history-navigation mode), the
 * end-session CTA, the elapsed timer, and the "Active
 * session" badge are all hidden. The chat still works —
 * the user just doesn't accrue mastery updates until they
 * start a study session from /subjects.
 */
export function TutorHeader({
  subject,
  topic,
  sessionId,
  threadMessageCount,
}: {
  readonly subject: {
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
  };
  readonly topic:
    | {
        readonly slug: string;
        readonly title: string;
      }
    | null;
  readonly sessionId: string | null;
  readonly threadMessageCount: number;
}) {
  const router = useRouter();
  const hasSession = sessionId !== null;
  const [endingPanel, setEndingPanel] = useState(false);
  const [reflection, setReflection] = useState("");
  const [pending, startTransition] = useTransition();
  const endSession = useMutation(api.tutor.endSession);
  const reflectionRef = useRef<HTMLTextAreaElement>(null);

  // Session start time, held in a ref so render stays pure
  // (no `Date.now()` during render). The `react-hooks/purity`
  // rule forbids `Date.now()` in initializers, so the ref
  // starts at 0 and is populated by an effect. A single
  // `[sessionId]`-keyed effect fires on mount (when
  // `sessionId` first becomes its initial value) and on
  // every subsequent session change, so we do not need a
  // separate one-shot effect. The `now` state is ticked
  // every second by `useNowTicker`; elapsed is derived in
  // the component body from `now - ref`.
  const startedAtRef = useRef<number>(0);
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, [sessionId]);
  const now = useNowTicker();
  // Reading a ref during render is fine when you are not
  // mutating it. The lint rule is overly strict here.
  // eslint-disable-next-line react-hooks/refs
  const elapsed = Math.max(0, Math.floor((now - startedAtRef.current) / 1000));

  const fillVar = resolveColorVar(subject.color);

  useEffect(() => {
    if (endingPanel) {
      reflectionRef.current?.focus();
    }
  }, [endingPanel]);

  const onEnd = () => {
    if (!hasSession) return;
    // Read the current elapsed time at click time, not the value
    // rendered by `useNowTicker` (which ticks every second
    // and may be up to a full second stale when the user has
    // been sitting on the "Confirm end" button).
    const actualElapsedSec = Math.max(
      0,
      Math.floor((Date.now() - startedAtRef.current) / 1000)
    );
    startTransition(async () => {
      try {
        await endSession({
          sessionId: sessionId as Id<"studySessions">,
          durationSec: actualElapsedSec,
          reflection:
            reflection.trim().length > 0 ? reflection.trim() : undefined,
        });
        const back = topic
          ? `/subjects/${subject.slug}/${topic.slug}`
          : `/subjects/${subject.slug}`;
        router.push(back);
      } catch (err) {
        console.error("Failed to end session:", err);
      }
    });
  };

  return (
    <header className="flex flex-col gap-4">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5"
      >
        <Link
          href="/subjects"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated/60 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm transition-colors hover:border-accent-border/60 hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" weight="bold" />
          All subjects
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <Link
          href={`/subjects/${subject.slug}`}
          className="rounded-full px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          {subject.title}
        </Link>
        {topic && (
          <>
            <span className="text-muted-foreground/50">/</span>
            <span className="rounded-full bg-accent-subtle/40 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
              {topic.title}
            </span>
          </>
        )}
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: `color-mix(in srgb, ${fillVar} 14%, transparent)`,
              borderColor: `color-mix(in srgb, ${fillVar} 30%, transparent)`,
            }}
            aria-hidden
          >
            <Books
              className="h-6 w-6"
              weight="duotone"
              style={{ color: fillVar }}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {hasSession ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent-border/50 bg-accent-subtle/60 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-accent">
                  <ChatCircleText className="h-2.5 w-2.5" weight="duotone" />
                  Active session
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated/60 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Chat history
                </span>
              )}
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                {threadMessageCount} message
                {threadMessageCount === 1 ? "" : "s"}
              </span>
            </div>
            <h1 className="mt-1.5 text-balance text-[clamp(1.5rem,2vw+0.5rem,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
              {topic ? topic.title : subject.title}
            </h1>
            {hasSession ? (
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Session running for {formatElapsed(elapsed)}.
              </p>
            ) : (
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Browsing past conversation. Start a session from the
                subject page to track mastery.
              </p>
            )}
          </div>
        </div>

        {hasSession && (
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {!endingPanel ? (
              <button
                type="button"
                onClick={() => setEndingPanel(true)}
                disabled={pending}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle className="h-3.5 w-3.5" weight="bold" />
                End session
              </button>
            ) : (
              <div
                onKeyDown={(e) => {
                  if (e.key === "Escape" && !pending) {
                    setEndingPanel(false);
                    setReflection("");
                  }
                }}
                className="flex w-full max-w-sm flex-col gap-2 rounded-xl border border-border bg-surface-elevated p-3 sm:w-80"
              >
                <label
                  htmlFor="tutor-reflection"
                  className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Quick reflection (optional)
                </label>
                <textarea
                  id="tutor-reflection"
                  ref={reflectionRef}
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  rows={3}
                  placeholder="What clicked? What is still fuzzy?"
                  className={cn(
                    "w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                  )}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEndingPanel(false);
                      setReflection("");
                    }}
                    disabled={pending}
                    className="inline-flex h-8 items-center rounded-md px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onEnd}
                    disabled={pending}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-medium text-accent-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Sparkle className="h-3 w-3" weight="duotone" />
                    {pending ? "Ending..." : "Confirm end"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * Format elapsed seconds as a short "Xm Ys" string.
 */
function formatElapsed(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/**
 * Tick every second while the component is mounted. Returns
 * the current Date.now() value as state so consumers re-render
 * once per second. Kept separate from the elapsed-time
 * computation so the ref read happens in the component
 * body, not inside this hook.
 */
function useNowTicker(): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

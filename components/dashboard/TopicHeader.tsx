"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  SkipForward,
  Sparkle,
  SubjectGlyph,
  Timer,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { resolveColorVar } from "@/lib/utils/subjectColor";
import { formatRelativeDate } from "@/lib/format/relativeDate";

/**
 * TopicHeader.
 *
 * The top band of
 * /subjects/[slug]/[chapterSlug]/[topicSlug].
 *
 * Per `docs/SYNEDRIX-FRONTEND-STYLE.md`:
 *
 *   - **No icon container.** The subject glyph renders at
 *     native size in the per-subject hue via the shared
 *     `SubjectGlyph` component (§8).
 *
 *   - **No pill chips.** Difficulty, "High yield", and
 *     "~N min" are plain uppercase mono with optional color
 *     emphasis (§1).
 *
 *   - **No bouncy CTA.** The primary "Start topic study
 *     session" button drops `active:scale-[0.98]`.
 *
 *   - **`hover:bg-accent/90`** not `hover:opacity-90` (§6).
 *
 *   - **Confirmation panel** uses a single-layer surface
 *     with a thin accent border, no `bg-accent-subtle/30`
 *     tinted panel.
 *
 * Client because the CTAs need useMutation + useRouter.push.
 * Both secondary actions are gated behind a 2-step inline
 * confirmation so a misclick does not silently rewrite the
 * user's progress.
 */
export function TopicHeader({
  subject,
  chapter,
  topic,
  skipHref,
}: {
  readonly subject: {
    readonly id: Id<"subjects">;
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
    readonly icon?: string;
  };
  readonly chapter: {
    readonly id: Id<"chapters">;
    readonly slug: string;
    readonly title: string;
    readonly order: number;
  };
  readonly topic: {
    readonly id: Id<"topics">;
    readonly slug: string;
    readonly title: string;
    readonly mastery: number;
    readonly confidence: number;
    readonly difficulty: "EASY" | "MEDIUM" | "HARD";
    readonly examRelevance: number;
    readonly estimatedMinutes: number | undefined;
    readonly lastStudiedAt: number | null;
    readonly isStudied: boolean;
    readonly timeSpentSec: number;
  };
  /**
   * The href the "Skip" action routes to. Provided by
   * the parent (`TopicDetailClient`) from `data.nextBest`
   * (or `/subjects/[slug]` as the fallback). Keeping the
   * href off the component means the header stays a
   * pure renderer and the page owns the next-best math.
   */
  readonly skipHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const startSession = useMutation(api.studySessions.start);
  const markMastered = useMutation(api.topics.markMastered);

  const [confirmingAction, setConfirmingAction] = useState<
    "mastered" | "skip" | null
  >(null);
  const [actionPending, setActionPending] = useState(false);

  const fillVar = resolveColorVar(subject.color);
  const masteryPct = Math.round(topic.mastery * 100);
  const masteryLabel = topic.isStudied
    ? `${masteryPct}% mastered`
    : "Not started";
  const difficultyColor =
    topic.difficulty === "EASY"
      ? "var(--subject-chemistry)"
      : topic.difficulty === "MEDIUM"
        ? "var(--subject-german)"
        : "var(--subject-french)";

  const onStartTopic = () => {
    startTransition(async () => {
      try {
        await startSession({
          subjectId: subject.id,
          topicId: topic.id,
          intention: `Studying ${topic.title}`,
        });
        router.push(
          `/tutor?subject=${encodeURIComponent(
            subject.slug,
          )}&topic=${encodeURIComponent(topic.slug)}&from=${encodeURIComponent(
            `/subjects/${subject.slug}/${chapter.slug}/${topic.slug}`,
          )}`,
        );
      } catch (err) {
        console.error("Failed to start topic session:", err);
      }
    });
  };

  const onMarkMastered = () => {
    setActionPending(true);
    startTransition(async () => {
      try {
        await markMastered({ topicId: topic.id });
        setConfirmingAction(null);
      } catch (err) {
        console.error("Failed to mark as mastered:", err);
      } finally {
        setActionPending(false);
      }
    });
  };

  const onSkip = () => {
    setActionPending(true);
    router.push(skipHref);
  };

  return (
    <header className="flex flex-col gap-5">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5"
      >
        <Link
          href="/subjects"
          className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" weight="bold" />
          All subjects
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <Link
          href={`/subjects/${subject.slug}`}
          className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          {subject.title}
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <Link
          href={`/subjects/${subject.slug}/${chapter.slug}`}
          className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Chapter {String(chapter.order).padStart(2, "0")}
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-foreground">
          {topic.title}
        </span>
      </nav>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <SubjectGlyph
            icon={subject.icon}
            className="mt-0.5 h-7 w-7 shrink-0"
            fillVar={fillVar}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                Topic
              </span>
              <h1 className="text-balance text-[clamp(1.6rem,2.2vw+0.5rem,2rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
                {topic.title}
              </h1>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span
                className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em]"
                style={{ color: difficultyColor }}
              >
                {topic.difficulty}
              </span>
              {topic.examRelevance >= 4 && (
                <span className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-foreground">
                  <Check className="h-2.5 w-2.5" weight="bold" />
                  High yield
                </span>
              )}
              {topic.estimatedMinutes !== undefined && (
                <span className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
                  <Timer className="h-2.5 w-2.5" weight="duotone" />
                  ~{topic.estimatedMinutes} min
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <MasteryPill mastery={topic.mastery} isStudied={topic.isStudied} />
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {masteryLabel}
                </span>
              </div>
              {topic.isStudied && topic.lastStudiedAt !== null && (
                <>
                  <span className="h-1 w-1 rounded-full bg-border" />
                  <span className="text-[11.5px] text-muted-foreground">
                    Last studied {formatRelativeDate(topic.lastStudiedAt)}
                  </span>
                </>
              )}
              {topic.confidence > 0 && (
                <>
                  <span className="h-1 w-1 rounded-full bg-border" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    Confidence {Math.round(topic.confidence * 100)}%
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onStartTopic}
            disabled={pending}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md px-5 text-[13.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              topic.isStudied
                ? "bg-accent text-accent-foreground hover:bg-accent/90"
                : "bg-foreground text-background hover:bg-foreground/90",
            )}
          >
            <Sparkle className="h-4 w-4" weight="duotone" />
            {pending ? "Starting..." : "Start topic study session"}
            {!pending && <ArrowRight className="h-4 w-4" weight="bold" />}
          </button>

          {confirmingAction === null && (
            <>
              <button
                type="button"
                onClick={() => setConfirmingAction("mastered")}
                disabled={pending || actionPending || (topic.isStudied && topic.mastery >= 1)}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-background px-3.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-accent/60 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                title="Mark this topic as mastered"
              >
                <CheckCircle className="h-3.5 w-3.5" weight="duotone" />
                Mark as mastered
              </button>
              <button
                type="button"
                onClick={() => setConfirmingAction("skip")}
                disabled={pending || actionPending}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-background px-3.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-accent/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                title="Skip to the next-best topic"
              >
                <SkipForward className="h-3.5 w-3.5" weight="duotone" />
                Skip
              </button>
            </>
          )}

          {confirmingAction === "mastered" && (
            <div
              className="flex w-full max-w-sm flex-col gap-2 rounded-md border border-accent/40 bg-background p-3 sm:w-80"
              onKeyDown={(e) => {
                if (e.key === "Escape" && !actionPending) {
                  setConfirmingAction(null);
                }
              }}
            >
              <p className="text-[12px] font-medium tracking-tight text-foreground">
                Mark &ldquo;{topic.title}&rdquo; as mastered?
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Mastery is set to 100% and the topic moves to the top of
                your recently studied list. You can still revisit it later.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingAction(null)}
                  disabled={actionPending}
                  className="inline-flex h-8 items-center rounded-md px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onMarkMastered}
                  disabled={actionPending}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Check className="h-3 w-3" weight="bold" />
                  {actionPending ? "Marking..." : "Confirm"}
                </button>
              </div>
            </div>
          )}

          {confirmingAction === "skip" && (
            <div
              className="flex w-full max-w-sm flex-col gap-2 rounded-md border border-border bg-background p-3 sm:w-80"
              onKeyDown={(e) => {
                if (e.key === "Escape" && !actionPending) {
                  setConfirmingAction(null);
                }
              }}
            >
              <p className="text-[12px] font-medium tracking-tight text-foreground">
                Skip to the next topic?
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                You can come back to this topic any time from the
                curriculum list. Mastery on this topic is unchanged.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingAction(null)}
                  disabled={actionPending}
                  className="inline-flex h-8 items-center rounded-md px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSkip}
                  disabled={actionPending}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <SkipForward className="h-3 w-3" weight="bold" />
                  {actionPending ? "Skipping..." : "Skip"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Compact mastery pill used in the topic header. A 96px-wide bar
 * with the percentage label overlaid; this is *not* a ring — we
 * kept the ring for /subjects/[slug] so the topic page feels
 * atomically smaller and visually distinct.
 *
 * Server-renderable; no animation library.
 */
function MasteryPill({
  mastery,
  isStudied,
}: {
  readonly mastery: number;
  readonly isStudied: boolean;
}) {
  const pct = Math.round(mastery * 100);
  return (
    <div
      role="meter"
      aria-label={`Topic mastery: ${pct} percent`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 w-24 overflow-hidden rounded-full bg-surface"
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{
          width: `${Math.max(isStudied ? 6 : 0, pct)}%`,
          backgroundColor: isStudied ? "var(--accent)" : "var(--muted)",
        }}
      />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowLeft,
  ArrowRight,
  Books,
  Check,
  Sparkle,
  Timer,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { resolveColorVar } from "@/lib/utils/subjectColor";
import { formatRelativeDate } from "@/lib/format/relativeDate";

/**
 * TopicHeader.
 *
 * The top band of /subjects/[slug]/[chapterSlug]/[topicSlug].
 *
 * Carries:
 *   - breadcrumb chain (all subjects / subject / chapter / topic)
 *   - subject color band + topic title
 *   - difficulty + estimated-minutes + exam-relevance pills
 *   - a compact mastery pill (no full ring — keeps the page
 *     atomic; the cockpit mastery ring stays on /subjects/[slug])
 *   - last-studied relative date when the user has any progress
 *   - the primary "Start study session on this topic" CTA,
 *     which fires `api.studySessions.start({ subjectId,
 *     topicId })` then routes to
 *     /tutor?subject=…&topic=… with the freshly-issued session
 *     id.
 *
 * Client because the CTA needs useMutation + useRouter.push.
 */
export function TopicHeader({
  subject,
  chapter,
  topic,
}: {
  readonly subject: {
    readonly id: Id<"subjects">;
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
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
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const startSession = useMutation(api.studySessions.start);

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
            subject.slug
          )}&topic=${encodeURIComponent(topic.slug)}`
        );
      } catch (err) {
        console.error("Failed to start topic session:", err);
      }
    });
  };

  return (
    <header className="flex flex-col gap-5">
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
        <span className="text-muted-foreground/50">/</span>
        <Link
          href={`/subjects/${subject.slug}/${chapter.slug}`}
          className="rounded-full px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Chapter {String(chapter.order).padStart(2, "0")}
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="rounded-full bg-accent-subtle/40 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
          {topic.title}
        </span>
      </nav>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: `color-mix(in srgb, ${fillVar} 14%, transparent)`,
              borderColor: `color-mix(in srgb, ${fillVar} 30%, transparent)`,
            }}
            aria-hidden
          >
            <Books
              className="h-7 w-7"
              weight="duotone"
              style={{ color: fillVar }}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-border bg-surface-elevated/60 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                Topic
              </span>
              <h1 className="text-balance text-[clamp(1.6rem,2.2vw+0.5rem,2rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
                {topic.title}
              </h1>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.16em]"
                style={{
                  backgroundColor: `color-mix(in srgb, ${difficultyColor} 10%, transparent)`,
                  borderColor: `color-mix(in srgb, ${difficultyColor} 28%, transparent)`,
                  color: difficultyColor,
                }}
              >
                {topic.difficulty}
              </span>
              {topic.examRelevance >= 4 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-foreground">
                  <Check className="h-2.5 w-2.5" weight="bold" />
                  High yield
                </span>
              )}
              {topic.estimatedMinutes !== undefined && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
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
              "inline-flex h-11 items-center gap-2 rounded-lg px-5 text-[13.5px] font-medium shadow-[var(--shadow-soft)] transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
              topic.isStudied
                ? "bg-accent text-accent-foreground"
                : "bg-foreground text-background"
            )}
          >
            <Sparkle className="h-4 w-4" weight="duotone" />
            {pending ? "Starting..." : "Start topic study session"}
            {!pending && <ArrowRight className="h-4 w-4" weight="bold" />}
          </button>
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

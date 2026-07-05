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
  ArrowUpRight,
  Check,
  SubjectGlyph,
  Sparkle,
  Timer,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { resolveColorVar } from "@/lib/utils/subjectColor";

/**
 * SubjectHeader.
 *
 * The top band of the /subjects/[slug] page. Carries the
 * breadcrumb back to /subjects, the subject's color-coded
 * identity, an enrollment badge, the estimated time to
 * mastery chip, an optional "Up next" pill driven by the
 * server-side `nextBest` recommendation, and the primary
 * CTA to start a study session.
 *
 * The CTA is the only interactive piece that fires a
 * mutation. It calls `studySessions.start` to record the
 * session, then navigates to the tutor pre-loaded with the
 * subject context. While the mutation is in flight, the
 * button shows a quiet "Starting..." state via
 * `useTransition`.
 *
 * ETA chip: `(unmasteredTopics * avgMinutes) / 60` where
 * `avgMinutes` is `aggregate.estimatedMinutesTotal /
 * aggregate.topicCount` (falling back to 30 if the subject
 * has no topics yet). Rounded to the nearest hour. Hidden
 * when the subject has no topics.
 *
 * "Up next" pill: rendered when `nextBest` is non-null,
 * linking to the first topic in the recommended chapter.
 * Hidden when the user has nothing to study next. Uses the
 * per-subject hue (not the global accent) so the pill
 * reads as "this is part of the subject", not "this is a
 * platform CTA".
 */
export function SubjectHeader({
  subject,
  enrolled,
  aggregate,
  nextBest,
}: {
  readonly subject: {
    readonly id: Id<"subjects">;
    readonly slug: string;
    readonly title: string;
    readonly description: string | null;
    readonly color?: string;
    readonly icon?: string;
  };
  readonly enrolled: boolean;
  /**
   * The same aggregate the `SubjectDetailClient` renders
   * into `SubjectDetailStats` below the header. We read
   * `topicCount`, `topicsStudied`, and
   * `estimatedMinutesTotal` to render the ETA chip.
   */
  readonly aggregate: {
    readonly topicCount: number;
    readonly topicsStudied: number;
    readonly estimatedMinutesTotal: number;
  };
  /**
   * The per-subject "Up next" recommendation from
   * `getBySlug.nextBest`. `null` when the user has
   * mastered every topic in the subject, or the subject
   * has no chapters. Hidden when null.
   */
  readonly nextBest: {
    readonly subject: { readonly slug: string; readonly title: string; readonly color?: string };
    readonly chapter: { readonly slug: string; readonly title: string };
    readonly topic: {
      readonly id: Id<"topics">;
      readonly slug: string;
      readonly title: string;
      readonly examRelevance: number;
      readonly mastery: number;
    };
    readonly reason: string;
  } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const startSession = useMutation(api.studySessions.start);
  const enroll = useMutation(api.subjects.enroll);
  const [enrollPending, startEnroll] = useTransition();
  const fillVar = resolveColorVar(subject.color);

  // ETA to mastery. Hidden when the subject has no topics
  // yet (the "Open" CTA is the right surface for an empty
  // catalog entry).
  const unmasteredTopics = Math.max(
    0,
    aggregate.topicCount - aggregate.topicsStudied
  );
  const avgMinutes =
    aggregate.topicCount > 0
      ? aggregate.estimatedMinutesTotal / aggregate.topicCount
      : 30;
  const etaHours =
    unmasteredTopics > 0
      ? Math.max(1, Math.round((unmasteredTopics * avgMinutes) / 60))
      : 0;
  const showEta = aggregate.topicCount > 0 && unmasteredTopics > 0;

  const onStart = () => {
    startTransition(async () => {
      try {
        await startSession({
          subjectId: subject.id,
          intention: `Opened ${subject.title} from the detail page`,
        });
        router.push(`/tutor?subject=${subject.slug}`);
      } catch (err) {
        console.error("Failed to start study session:", err);
      }
    });
  };

  const onEnroll = () => {
    startEnroll(() => {
      void enroll({ subjectId: subject.id });
    });
  };

  return (
    <header className="flex flex-col gap-5">
      <Link
        href="/subjects"
        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface-elevated/60 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm transition-colors hover:border-accent-border/60 hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" weight="bold" />
        All subjects
      </Link>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: `color-mix(in srgb, ${fillVar} 14%, transparent)`,
              borderColor: `color-mix(in srgb, ${fillVar} 30%, transparent)`,
            }}
            aria-hidden
          >
            <SubjectGlyph icon={subject.icon} className="h-6 w-6" fillVar={fillVar} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-balance text-[clamp(1.6rem,2.2vw+0.5rem,2rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
                {subject.title}
              </h1>
              {enrolled ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent-border/50 bg-accent-subtle/60 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-accent">
                  <Check className="h-2.5 w-2.5" weight="bold" />
                  Enrolled
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Not enrolled
                </span>
              )}
              {showEta && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border bg-surface-elevated px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.12em]"
                  style={{
                    borderColor: `color-mix(in srgb, ${fillVar} 30%, transparent)`,
                    color: fillVar,
                  }}
                >
                  <Timer className="h-2.5 w-2.5" weight="duotone" />
                  ~ {etaHours}h to mastery
                </span>
              )}
            </div>
            {subject.description && (
              <p className="mt-2 max-w-xl text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
                {subject.description}
              </p>
            )}
            {nextBest && enrolled && (
              <Link
                href={`/subjects/${nextBest.subject.slug}/${nextBest.chapter.slug}/${nextBest.topic.slug}`}
                className="mt-3 inline-flex h-9 w-fit items-center gap-2 rounded-full border bg-surface-elevated/60 px-3 text-[12px] font-medium text-foreground backdrop-blur-sm transition-colors hover:border-accent-border/60"
                style={{
                  borderColor: `color-mix(in srgb, ${fillVar} 30%, transparent)`,
                }}
                title={nextBest.reason}
              >
                <span
                  className="font-mono text-[9.5px] uppercase tracking-[0.16em]"
                  style={{ color: fillVar }}
                >
                  Up next
                </span>
                <span className="max-w-[200px] truncate">{nextBest.topic.title}</span>
                <ArrowUpRight className="h-3 w-3" weight="bold" />
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {enrolled ? (
            <button
              type="button"
              onClick={onStart}
              disabled={pending}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-[13.5px] font-medium text-accent-foreground shadow-[var(--shadow-soft)] transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              )}
            >
              <Sparkle className="h-4 w-4" weight="duotone" />
              {pending ? "Starting..." : "Start a study session"}
              {!pending && (
                <ArrowRight className="h-4 w-4" weight="bold" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onEnroll}
              disabled={enrollPending}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-lg bg-foreground px-5 text-[13.5px] font-medium text-background transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              )}
            >
              {enrollPending ? "Adding..." : "Enroll to start"}
              <ArrowRight className="h-4 w-4" weight="bold" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

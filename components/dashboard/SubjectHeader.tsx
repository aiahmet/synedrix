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
  Check,
  Sparkle,
  SubjectGlyph,
  Timer,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { resolveColorVar } from "@/lib/utils/subjectColor";

/**
 * SubjectHeader.
 *
 * The top band of the /subjects/[slug] page. Per the
 * `docs/SYNEDRIX-FRONTEND-STYLE.md` rulebook:
 *
 *   - **No icon container.** The subject glyph renders at
 *     native size in the per-subject hue via the shared
 *     `SubjectGlyph` component (§8).
 *
 *   - **No pill chips.** The "Enrolled" badge and "~Nh to
 *     mastery" chip are replaced with plain uppercase muted
 *     text (§1, §2: pill/track eyebrow chips are banned).
 *
 *   - **No bouncy CTA.** The "Start a study session" button
 *     drops `active:scale-[0.98]` (§1, §6).
 *
 *   - **`hover:bg-accent/90`** replaces `hover:opacity-90` (§6).
 *
 * Plan §1.2: the inline "Up next" pill that used to live here
 * was removed in a prior pass. The full-width `UpNextBanner`
 * (rendered by `SubjectDetailClient` between the header and the
 * stats row) is the new home for the same recommendation. Two
 * adjacent CTAs for the same target were redundant; the banner
 * is the hero, the header is identity.
 */
export function SubjectHeader({
  subject,
  enrolled,
  aggregate,
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
  readonly aggregate: {
    readonly topicCount: number;
    readonly topicsStudied: number;
    readonly estimatedMinutesTotal: number;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const startSession = useMutation(api.studySessions.start);
  const enroll = useMutation(api.subjects.enroll);
  const [enrollPending, startEnroll] = useTransition();
  const fillVar = resolveColorVar(subject.color);

  const unmasteredTopics = Math.max(
    0,
    aggregate.topicCount - aggregate.topicsStudied,
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
        router.push(
          `/tutor?subject=${subject.slug}&from=${encodeURIComponent(
            `/subjects/${subject.slug}`,
          )}`,
        );
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
        className="inline-flex w-fit items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" weight="bold" />
        All subjects
      </Link>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {/* Subject glyph at native size, per-subject hue,
              no container. */}
          <SubjectGlyph
            icon={subject.icon}
            className="mt-0.5 h-7 w-7 shrink-0"
            fillVar={fillVar}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="text-balance text-[clamp(1.6rem,2.2vw+0.5rem,2rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
                {subject.title}
              </h1>
              {enrolled ? (
                <span className="inline-flex items-center gap-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-accent">
                  <Check className="h-3 w-3" weight="bold" />
                  Enrolled
                </span>
              ) : (
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Not enrolled
                </span>
              )}
              {showEta && (
                <span
                  className="inline-flex items-center gap-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em]"
                  style={{ color: fillVar }}
                >
                  <Timer className="h-3 w-3" weight="duotone" />
                  ~ {etaHours}h to mastery
                </span>
              )}
            </div>
            {subject.description && (
              <p className="mt-2 max-w-xl text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
                {subject.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {enrolled ? (
            <button
              type="button"
              onClick={onStart}
              disabled={pending}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-5 text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkle className="h-4 w-4" weight="duotone" />
              {pending ? "Starting..." : "Start a study session"}
              {!pending && <ArrowRight className="h-4 w-4" weight="bold" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={onEnroll}
              disabled={enrollPending}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-5 text-[13.5px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60",
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

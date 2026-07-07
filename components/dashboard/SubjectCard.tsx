"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CockpitCard } from "./CockpitCard";
import { MasteryRing } from "./MasteryRing";
import {
  ArrowRight,
  CalendarBlank,
  Check,
  Plus,
  Stack,
  SubjectGlyph,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { resolveColorVar } from "@/lib/utils/subjectColor";
import { subjectShortBlurb } from "@/lib/subjectShortBlurbs";
import { formatRelativeDate } from "@/lib/format/relativeDate";

/**
 * Subject card with enroll/leave + per-card progress.
 *
 * Per `docs/SYNEDRIX-FRONTEND-STYLE.md`:
 *
 *   - **Single-layer card.** The previous version was a
 *     double-bezel (`rounded-2xl` outer + `rounded-xl` inner)
 *     which the rulebook lists as the triple-nested anti-pattern.
 *     `CockpitCard` is now single-layer.
 *
 *   - **No icon container.** The subject glyph renders at native
 *     size in the per-subject hue. The previous
 *     `bg-color-mix(fillVar, 12%) border-color-mix(fillVar, 28%)`
 *     container is removed; the rulebook §8 says "Never wrap an
 *     icon in `bg-accent/10 ring-1 ring-accent/10`." We use
 *     the existing `SubjectGlyph` component (which already
 *     applies the per-subject color via `style`) and skip any
 *     wrapper markup.
 *
 *   - **No pill chip.** The "Enrolled" badge is replaced with
 *     plain uppercase muted text. Pill/track eyebrow chips are
 *     banned (§1).
 *
 *   - **No bouncy CTA.** Buttons don't bounce. `active:scale-[0.98]`
 *     is removed (§1, §6).
 *
 *   - **`hover:bg-accent/90`** not `hover:opacity-90` (§6).
 *
 * The card composes four regions: subject identity (icon + title
 * + blurb), mastery strip (ring + percent for enrolled cards),
 * meta strip (chapter count, topic progress, last-studied), and
 * the context-aware CTA. The 2px mastery bar at the bottom
 * (per-subject hue) survives the refactor — it is the only place
 * the per-subject color appears in the card body, and the rulebook
 * allows one categorical color (the per-subject hue is one of
 * the six, used sparingly).
 */
export function SubjectCard({
  subject,
}: {
  readonly subject: {
    readonly id: Id<"subjects">;
    readonly slug: string;
    readonly title: string;
    readonly description?: string;
    readonly color?: string;
    readonly icon?: string;
    readonly enrolled: boolean;
    readonly enrolledAt: number | null;
    readonly chapterCount: number;
    readonly topicCount: number;
    readonly mastery: number;
    readonly topicsStudied: number;
    readonly lastStudiedAt: number | null;
    readonly firstTopic: {
      readonly slug: string;
      readonly chapterSlug: string;
      readonly title: string;
      readonly mastery: number;
    } | null;
  };
}) {
  const fillVar = resolveColorVar(subject.color);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoOpenOnEnroll = searchParams.get("intent") === "start";
  const enroll = useMutation(api.subjects.enroll);
  const leave = useMutation(api.subjects.leave);

  const onEnroll = () => {
    startTransition(async () => {
      await enroll({ subjectId: subject.id });
      if (autoOpenOnEnroll) {
        router.push(`/subjects/${subject.slug}`);
      }
    });
  };

  const onLeave = () => {
    startTransition(() => {
      void leave({ subjectId: subject.id });
    });
  };

  const hasFirstTopic = subject.firstTopic !== null;
  const continueHref = hasFirstTopic
    ? `/subjects/${subject.slug}/${subject.firstTopic!.chapterSlug}/${subject.firstTopic!.slug}`
    : `/subjects/${subject.slug}`;
  const continueLabel =
    subject.enrolled && subject.topicsStudied > 0
      ? "Continue"
      : subject.enrolled
        ? "Start first topic"
        : null;
  const masteryPct = Math.round(subject.mastery * 100);
  const chipLine = subjectShortBlurb(subject.slug) ?? subject.description;

  return (
    <CockpitCard
      className={cn(
        "relative flex h-full flex-col overflow-hidden",
        "transition-shadow duration-300 hover:shadow-[0_1px_3px_rgba(0,0,0,0.04),0_14px_40px_-12px_rgba(0,0,0,0.10)]",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Subject glyph at native size via the shared
            `SubjectGlyph` component. No container. The
            component applies the per-subject hue internally. */}
        <SubjectGlyph
          icon={subject.icon}
          className="mt-0.5 h-5 w-5 shrink-0"
          fillVar={fillVar}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
              {subject.title}
            </h3>
            {subject.enrolled && (
              <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-accent">
                <Check className="h-3 w-3" weight="bold" />
                Enrolled
              </span>
            )}
          </div>
          {chipLine && (
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {chipLine}
            </p>
          )}
        </div>
      </div>

      {subject.enrolled && subject.topicCount > 0 && (
        <div className="mt-5 flex items-center gap-3">
          <MasteryRing
            value={subject.mastery}
            size={44}
            strokeWidth={4}
            label={`${masteryPct}%`}
            ariaLabel={`Subject mastery ${masteryPct} percent`}
            colorVar={fillVar}
          />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              Mastery
            </p>
            <p className="text-[12.5px] font-medium tracking-tight text-foreground">
              {masteryPct}% across {subject.topicsStudied} of {subject.topicCount} topics
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Stack className="h-3 w-3" weight="duotone" />
          {subject.chapterCount}{" "}
          {subject.chapterCount === 1 ? "chapter" : "chapters"}
        </span>
        <span className="h-1 w-1 rounded-full bg-border" aria-hidden />
        <span>
          {subject.enrolled && subject.topicsStudied > 0
            ? `${subject.topicsStudied} / ${subject.topicCount} topics`
            : `${subject.topicCount} topics`}
        </span>
        {subject.lastStudiedAt !== null && subject.enrolled && (
          <>
            <span className="h-1 w-1 rounded-full bg-border" aria-hidden />
            <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              <CalendarBlank className="h-3 w-3" weight="duotone" />
              {formatRelativeDate(subject.lastStudiedAt)}
            </span>
          </>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-border/60 pt-4">
        {subject.enrolled ? (
          <>
            {hasFirstTopic ? (
              <Link
                href={continueHref}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
              >
                {continueLabel}
                <ArrowRight className="h-3.5 w-3.5" weight="bold" />
              </Link>
            ) : (
              <Link
                href={continueHref}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
              >
                Open
                <ArrowRight className="h-3.5 w-3.5" weight="bold" />
              </Link>
            )}
            <button
              type="button"
              onClick={onLeave}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-subject-french/40 hover:text-subject-french disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Leaving..." : "Leave"}
            </button>
          </>
        ) : (
          <>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              Not enrolled
            </span>
            <button
              type="button"
              onClick={onEnroll}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" weight="bold" />
              {pending ? "Adding..." : "Add subject"}
            </button>
          </>
        )}
      </div>

      {/* The per-subject mastery strip at the bottom of the card.
          This is the only place the per-subject color is used in
          the card body. Renders a 2px-tall fill so a glance at
          the catalog grid reveals which subject is the strongest.
          The strip respects the `overflow-hidden` on the card so
          it never escapes the rounded corners. */}
      {subject.enrolled && subject.topicCount > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-border/40"
        >
          <div
            className="h-full transition-[width] duration-700 ease-out"
            style={{
              width: `${masteryPct}%`,
              backgroundColor: fillVar,
            }}
          />
        </div>
      )}
    </CockpitCard>
  );
}

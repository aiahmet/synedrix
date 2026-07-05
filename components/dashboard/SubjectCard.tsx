"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CockpitCard } from "./CockpitCard";
import {
  ArrowRight,
  CalendarBlank,
  Check,
  Plus,
  SubjectGlyph,
  Stack,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { resolveColorVar } from "@/lib/utils/subjectColor";
import { subjectShortBlurb } from "@/lib/subjectShortBlurbs";
import { formatRelativeDate } from "@/lib/format/relativeDate";

/**
 * Subject card with enroll/leave + per-card progress.
 *
 * Server-renderable shape, but the action buttons are client
 * (they need to call Convex mutations). The card itself is
 * composed of three regions: a static information block
 * (top), a meta strip (middle, with last-studied + topics
 * progress), and a client action region (bottom, with the
 * context-aware CTA). A 3px-tall progress strip at the very
 * bottom of the card visualizes the user's mastery against
 * the subject's hue.
 *
 * The mutation is wired via `useMutation`, which is the
 * standard Convex pattern. Because the subjects query is
 * shared between the page and the mutation's optimistic
 * update, the card updates instantly on click without a
 * manual refetch.
 *
 * The card's `subject` shape is the canonical SubjectList
 * row returned by `api.subjects.list` (extended in the
 * SUBJECT-IMPROVEMENT-PLAN to include mastery, topicsStudied,
 * lastStudiedAt, firstTopic).
 */
export function SubjectCard({
  subject,
}: {
  readonly subject: {
    readonly id: Id<"subjects">;
    readonly slug: string;
    readonly title: string;
    // Mirrors the canonical `subjects.list` query: `v.optional(v.string())`
    // → `string | undefined`. The card body falls through to
    // `subjectShortBlurb(slug)` first, so a missing description
    // is fine — the card simply renders no blurb line.
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
  // The empty-state dashboard CTA sets `?intent=start`. When
  // that flag is set, enrolling is the last step of an
  // onboarding flow — the user wanted to start studying, not
  // browse the catalog. We auto-navigate into the subject
  // detail page on success so they do not have to click the
  // freshly-enabled "Open" button.
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

  // CTA + href logic. The plan calls for a context-aware
  // primary action so the card always points at the next
  // thing to do:
  //
  //   - Enrolled + has progress   -> "Continue" -> first topic
  //   - Enrolled + zero progress  -> "Start first topic" -> first topic
  //   - Not enrolled              -> "Add subject" (enroll inline)
  //
  // When the subject has no topics yet, "Add subject" stays
  // the only available action. The Leave button only shows
  // in the enrolled branch.
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
  // The short blurb is the chip/strip-level description
  // (≤ 80 chars). It is preferred over the long
  // `description` for the card body because the card
  // has a 2-line clamp. Falls back to the long
  // description if the slug has no entry in
  // SUBJECT_SHORT_BLURBS yet.
  const chipLine = subjectShortBlurb(subject.slug) ?? subject.description;

  return (
    <CockpitCard className="relative flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] active:translate-y-0 active:shadow-[var(--shadow-soft)] motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
          style={{
            backgroundColor: `color-mix(in srgb, ${fillVar} 12%, transparent)`,
            borderColor: `color-mix(in srgb, ${fillVar} 28%, transparent)`,
          }}
          aria-hidden
        >
          <SubjectGlyph icon={subject.icon} className="h-[1.15rem] w-[1.15rem]" fillVar={fillVar} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[14.5px] font-semibold tracking-tight text-foreground">
              {subject.title}
            </h3>
            {subject.enrolled && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent-border/50 bg-accent-subtle/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-accent">
                <Check className="h-2.5 w-2.5" weight="bold" />
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
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[12.5px] font-medium text-accent-foreground transition-all hover:opacity-90 active:scale-[0.98]"
              >
                {continueLabel}
                <ArrowRight className="h-3.5 w-3.5" weight="bold" />
              </Link>
            ) : (
              <Link
                href={continueHref}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[12.5px] font-medium text-accent-foreground transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Open
                <ArrowRight className="h-3.5 w-3.5" weight="bold" />
              </Link>
            )}
            <button
              type="button"
              onClick={onLeave}
              disabled={pending}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 text-[12.5px] font-medium text-muted-foreground transition-all hover:border-subject-french/40 hover:text-subject-french disabled:cursor-not-allowed disabled:opacity-60"
              )}
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
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-[12.5px] font-medium text-background transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              )}
            >
              <Plus className="h-3.5 w-3.5" weight="bold" />
              {pending ? "Adding..." : "Add subject"}
            </button>
          </>
        )}
      </div>

      {/* 3px-tall mastery strip at the very bottom of the
          card. Filled with the subject's hue (not the
          global accent) so a glance at the grid reveals
          which subject is the strongest at a glance.
          Rendered ONLY for enrolled cards. A non-enrolled
          card has no mastery to surface, and a 0% sliver
          reads as "you have made progress" — which would
          be wrong. The card is wrapped in `relative
          overflow-hidden` (CockpitCard) so the strip
          never escapes the rounded corners. */}
      {subject.enrolled && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-border/30"
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

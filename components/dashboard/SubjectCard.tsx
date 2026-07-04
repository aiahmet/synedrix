"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CockpitCard } from "./CockpitCard";
import {
  ArrowRight,
  Books,
  Check,
  Plus,
  Stack,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { resolveColorVar } from "@/lib/utils/subjectColor";

/**
 * Subject card with enroll/leave action.
 *
 * Server-renderable shape, but the action buttons are client
 * (they need to call Convex mutations). The card itself is
 * composed of two regions: a static information block (top) and
 * a client action region (bottom).
 *
 * The mutation is wired via `useMutation`, which is the standard
 * Convex pattern. Because the subjects query is shared between
 * the page and the mutation's optimistic update, the card
 * updates instantly on click without a manual refetch.
 */
export function SubjectCard({
  subject,
}: {
  readonly subject: {
    readonly id: Id<"subjects">;
    readonly slug: string;
    readonly title: string;
    readonly description: string | null;
    readonly color?: string;
    readonly icon?: string;
    readonly enrolled: boolean;
    readonly enrolledAt: number | null;
    readonly chapterCount: number;
    readonly topicCount: number;
  };
}) {
  const fillVar = resolveColorVar(subject.color);
  const [pending, startTransition] = useTransition();
  const enroll = useMutation(api.subjects.enroll);
  const leave = useMutation(api.subjects.leave);

  const onEnroll = () => {
    startTransition(() => {
      void enroll({ subjectId: subject.id });
    });
  };

  const onLeave = () => {
    startTransition(() => {
      void leave({ subjectId: subject.id });
    });
  };

  return (
    <CockpitCard className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
          style={{
            backgroundColor: `color-mix(in srgb, ${fillVar} 12%, transparent)`,
            borderColor: `color-mix(in srgb, ${fillVar} 28%, transparent)`,
          }}
          aria-hidden
        >
          <Books
            className="h-[1.15rem] w-[1.15rem]"
            weight="duotone"
            style={{ color: fillVar }}
          />
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
          {subject.description && (
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {subject.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 text-[11.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Stack className="h-3 w-3" weight="duotone" />
          {subject.chapterCount} {subject.chapterCount === 1 ? "chapter" : "chapters"}
        </span>
        <span className="h-1 w-1 rounded-full bg-border" />
        <span>{subject.topicCount} topics</span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-border/60 pt-4">
        {subject.enrolled ? (
          <>
            <Link
              href={`/subjects/${subject.slug}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[12.5px] font-medium text-accent-foreground transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Open
              <ArrowRight className="h-3.5 w-3.5" weight="bold" />
            </Link>
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
    </CockpitCard>
  );
}

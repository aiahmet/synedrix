"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Check,
  Plus,
  SubjectGlyph,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { resolveColorVar } from "@/lib/utils/subjectColor";
import { subjectShortBlurb } from "@/lib/subjectShortBlurbs";

/**
 * AvailableSubjectStrip.
 *
 * Inline subject picker surfaced inside the dashboard's
 * empty cockpit when the user has no enrollments yet. Each
 * canonical subject renders as a chip with a one-click
 * "+ Add" button. On click, the enroll mutation runs through
 * mutating `api.subjects.list`, which Convex reactively
 * re-broadcasts — every chip that just became enrolled
 * flips to an "Enrolled" badge instantly. When the last
 * enrolled chip transitions, the parent `DashboardOverviewClient`
 * reactively flips from `isEmpty=true` to `isEmpty=false`
 * and swaps in the populated cockpit without a refresh.
 *
 * Why a client island (not the static EmptySubjectsState
 * diagram): the parent empty-state is server-rendered for
 * first-paint speed. The strip needs `useMutation` for the
 * enroll call and `usePreloadedQuery` reactivity for the
 * post-enroll UI flip, both of which require client.
 */
export function AvailableSubjectStrip({
  subjects,
}: {
  readonly subjects: ReadonlyArray<{
    readonly id: Id<"subjects">;
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
    readonly icon?: string;
    readonly enrolled: boolean;
    readonly topicCount: number;
  }>;
}) {
  return (
    <ul
      aria-label="Available subjects"
      className="flex flex-col divide-y divide-border/40"
    >
      {subjects.map((s) => (
        <SubjectChip key={s.id} subject={s} />
      ))}
    </ul>
  );
}

function SubjectChip({
  subject,
}: {
  readonly subject: {
    readonly id: Id<"subjects">;
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
    readonly icon?: string;
    readonly enrolled: boolean;
    readonly topicCount: number;
  };
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const enroll = useMutation(api.subjects.enroll);
  const fillVar = resolveColorVar(subject.color);

  const onEnroll = () => {
    // Cache-bust + navigate so the user lands on the freshly
    // enrolled subject detail page. The dashboard's
    // `usePreloadedQuery(api.subjects.list)` will fire
    // reactively on the next render anyway, but `router.refresh()`
    // re-runs the server components (and re-renders the cockpit
    // query) so the populated view appears without any flash of
    // "added" state.
    startTransition(async () => {
      await enroll({ subjectId: subject.id });
      router.push(`/subjects/${subject.slug}`);
    });
  };

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
        style={{
          backgroundColor: `color-mix(in srgb, ${fillVar} 12%, transparent)`,
          borderColor: `color-mix(in srgb, ${fillVar} 28%, transparent)`,
        }}
        aria-hidden
      >
        <SubjectGlyph icon={subject.icon} className="h-[0.95rem] w-[0.95rem]" fillVar={fillVar} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold tracking-tight text-foreground">
          {subject.title}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {subjectShortBlurb(subject.slug) ??
            `${subject.topicCount} ${
              subject.topicCount === 1 ? "topic" : "topics"
            }`}
        </p>
      </div>

      {subject.enrolled ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent-border/50 bg-accent-subtle/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-accent">
          <Check className="h-2.5 w-2.5" weight="bold" />
          Enrolled
        </span>
      ) : (
        <button
          type="button"
          onClick={onEnroll}
          disabled={pending}
          aria-label={`Add ${subject.title}`}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md bg-foreground px-2.5 text-[11.5px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          <Plus className="h-3 w-3" weight="bold" />
          {pending ? "Adding" : "Add"}
        </button>
      )}
    </li>
  );
}

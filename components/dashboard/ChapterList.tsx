import Link from "next/link";

import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { cn } from "@/lib/utils/cn";
import { Stack, Timer } from "@/components/landing/icons";
import { formatRelativeDate } from "@/lib/format/relativeDate";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * A single chapter row in the chapter list.
 */
export interface ChapterListEntry {
  readonly id: Id<"chapters">;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly order: number;
  readonly topicCount: number;
  readonly topicsStudied: number;
  readonly mastery: number;
  readonly lastStudiedAt: number | null;
}

/**
 * ChapterList.
 *
 * Renders the ordered chapter list under a single CockpitCard.
 * Each row is a real anchor link so the user can drill into a
 * chapter from this page. Per-chapter mastery is shown as a
 * thin bar; topic count and last-studied date are right-aligned
 * for at-a-glance scanning.
 *
 * The list is server-renderable. Hover styles use Tailwind
 * tokens; the row is wrapped in a Next <Link> for client-side
 * navigation.
 */
export function ChapterList({
  chapters,
  subjectSlug,
}: {
  readonly chapters: readonly ChapterListEntry[];
  readonly subjectSlug: string;
}) {
  if (chapters.length === 0) {
    return (
      <CockpitCard>
        <div className="flex flex-col items-center gap-1 py-8 text-center">
          <p className="text-[13.5px] font-medium text-foreground">
            No chapters indexed yet.
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            The curriculum is still being authored for this subject.
          </p>
        </div>
      </CockpitCard>
    );
  }

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Curriculum"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {chapters.length} chapters
          </span>
        }
      />
      <ol className="flex flex-col divide-y divide-border/60">
        {chapters.map((ch) => (
          <ChapterRow key={ch.id} chapter={ch} subjectSlug={subjectSlug} />
        ))}
      </ol>
    </CockpitCard>
  );
}

function ChapterRow({
  chapter,
  subjectSlug,
}: {
  readonly chapter: ChapterListEntry;
  readonly subjectSlug: string;
}) {
  const pct = Math.round(chapter.mastery * 100);
  const isEmpty = chapter.topicsStudied === 0;
  const lastStudiedLabel = chapter.lastStudiedAt
    ? formatRelativeDate(chapter.lastStudiedAt)
    : "Not started";

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <Link
        href={`/subjects/${subjectSlug}/${chapter.slug}`}
        className="group flex items-center gap-4 rounded-lg px-1 py-1 outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono text-[11px] tabular-nums",
            isEmpty
              ? "border-border bg-surface text-muted-foreground"
              : "border-accent-border/50 bg-accent-subtle/40 text-accent"
          )}
          aria-hidden
        >
          {String(chapter.order).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[13.5px] font-semibold tracking-tight text-foreground">
              {chapter.title}
            </p>
            <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
              {pct}%
            </span>
          </div>

          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
            <div
              className={cn("h-full rounded-full transition-[width] duration-500")}
              style={{
                width: `${Math.max(2, pct)}%`,
                backgroundColor: "var(--accent)",
              }}
            />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Stack className="h-3 w-3" weight="duotone" />
              {chapter.topicsStudied} / {chapter.topicCount} topics
            </span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3 w-3" weight="duotone" />
              {lastStudiedLabel}
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

"use client";

import { useMemo, useState } from "react";

import { SubjectCard } from "./SubjectCard";
import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { SubjectsSearch } from "./SubjectsSearch";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils/cn";

/**
 * SubjectsGrid.
 *
 * Responsive grid of subject cards. Owns the client-only filter
 * state (All / Enrolled / Available) AND the client-only sort
 * state (Recent / Mastery / Name). The data is passed in
 * pre-resolved from the server-preloaded query, so this
 * component never needs to re-fetch.
 *
 * Per `docs/SYNEDRIX-FRONTEND-STYLE.md`:
 *
 *   - **Single active treatment.** Both the filter chips and
 *     the sort chips use the same `bg-accent text-accent-foreground`
 *     "active = louder" treatment. Inconsistent active states
 *     inside one control bar reads as accidental, not
 *     deliberate (§4.2: "One accent per page").
 *
 *   - **No pill chip with count badge.** The count is inline in
 *     the label, so the chip is one flat element instead of a
 *     chip-inside-a-chip.
 *
 *   - **No bouncy CTAs.**
 *
 *   - **No carded list rows in the empty state.**
 *
 * Sort + filter interaction: the Convex `list` query returns
 * the backend default order (enrolled-first by enrollment time
 * desc, then alpha). The "Recent" sort dropdown option
 * preserves that order verbatim. "Mastery" sorts enrolled
 * subjects by mastery desc, available subjects by alpha.
 * "Name" sorts all alpha. The sort dropdown only re-orders
 * the visible array; it does not refetch.
 */
export function SubjectsGrid({
  subjects,
}: {
  readonly subjects: ReadonlyArray<{
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
  }>;
}) {
  const [filter, setFilter] = useState<"all" | "enrolled" | "available">("all");
  const [sort, setSort] = useState<"recent" | "mastery" | "name">("recent");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr: typeof subjects;
    if (filter === "enrolled") arr = subjects.filter((s) => s.enrolled);
    else if (filter === "available") arr = subjects.filter((s) => !s.enrolled);
    else arr = subjects;
    if (q.length > 0) {
      arr = arr.filter((s) => {
        return (
          s.title.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          (s.description?.toLowerCase().includes(q) ?? false)
        );
      });
    }
    return arr;
  }, [filter, query, subjects]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "name") {
      arr.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "mastery") {
      arr.sort((a, b) => {
        if (a.enrolled && !b.enrolled) return -1;
        if (!a.enrolled && b.enrolled) return 1;
        if (a.enrolled && b.enrolled) {
          if (b.mastery !== a.mastery) return b.mastery - a.mastery;
        }
        return a.title.localeCompare(b.title);
      });
    }
    return arr;
  }, [filtered, sort]);

  const enrolledCount = subjects.filter((s) => s.enrolled).length;
  const availableCount = subjects.length - enrolledCount;

  return (
    <div className="flex flex-col gap-5">
      <CockpitCard>
        <CockpitCardHeader
          label="Filter &amp; sort"
          trailing={
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              {subjects.length} subjects · {enrolledCount} enrolled
            </span>
          }
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SubjectsSearch value={query} onChange={setQuery} />
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label="All"
              count={subjects.length}
            />
            <FilterChip
              active={filter === "enrolled"}
              onClick={() => setFilter("enrolled")}
              label="Enrolled"
              count={enrolledCount}
            />
            <FilterChip
              active={filter === "available"}
              onClick={() => setFilter("available")}
              label="Available"
              count={availableCount}
            />
          </div>
          <div
            role="radiogroup"
            aria-label="Sort subjects"
            className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-md border border-border bg-background p-0.5"
          >
            <SortChip
              active={sort === "recent"}
              onClick={() => setSort("recent")}
              label="Recent"
            />
            <SortChip
              active={sort === "mastery"}
              onClick={() => setSort("mastery")}
              label="Mastery"
            />
            <SortChip
              active={sort === "name"}
              onClick={() => setSort("name")}
              label="Name"
            />
          </div>
        </div>
      </CockpitCard>

      {sorted.length === 0 ? (
        <CockpitCard>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-[13.5px] font-medium text-foreground">
              {filter === "enrolled"
                ? "You haven't enrolled in any subjects yet."
                : filter === "available"
                  ? "You're enrolled in every available subject."
                  : "No subjects indexed yet."}
            </p>
            <p className="max-w-sm text-[12.5px] text-muted-foreground">
              {filter === "enrolled"
                ? "Pick one from the available tab to start a new study loop."
                : "Add one to start tracking your progress on the cockpit."}
            </p>
          </div>
        </CockpitCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((s) => (
            <SubjectCard key={s.id} subject={s} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * SortChip.
 *
 * One cell of the sort segmented control. Radiogroup
 * semantics so screen readers read it as a single choice
 * with a current selection. The active state uses the
 * accent surface; inactive stays muted. No pill chip.
 */
function SortChip({
  active,
  onClick,
  label,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-sm px-3 text-[11.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/**
 * FilterChip.
 *
 * One filter chip. Plain border, no inner count pill. Active
 * state matches the SortChip exactly: `bg-accent text-accent-foreground`.
 * Two different "active" treatments in the same toolbar
 * would be a visual hierarchy bug.
 */
function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly label: string;
  readonly count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md border px-3 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-background text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      {label}
      <span className="font-mono text-[10.5px] tabular-nums opacity-80">
        {count}
      </span>
    </button>
  );
}

"use client";

import { useMemo } from "react";
import { Preloaded, usePreloadedQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { CockpitStatsRow } from "@/components/dashboard/CockpitStatsRow";
import { SubjectMasteryStrip } from "@/components/dashboard/SubjectMasteryStrip";
import { EmptySubjectsState } from "@/components/dashboard/EmptySubjectsState";

/**
 * DashboardOverviewClient.
 *
 * The only client island on the dashboard page. Subscribes to
 * two preloaded Convex queries: `dashboard.getOverview` (the
 * main cockpit payload) and `subjects.list` (the canonical
 * curriculum + per-user enrollment state).
 *
 * The second query exists so the empty cockpit can render an
 * inline one-click subject picker. Convex reactivity makes the
 * "Enrolled" badges flip instantly when the user clicks an Add
 * chip; the parent cockpit's `data.isEmpty` then flips to
 * `false` and the populated view swaps in without a refresh.
 *
 * The component is intentionally tiny. All the visual
 * language lives in the server-rendered child components so
 * the cockpit reads as a single design system even before
 * hydration.
 */
export function DashboardOverviewClient({
  preloaded,
  subjectsPreloaded,
  fallbackName,
}: {
  readonly preloaded: Preloaded<typeof api.dashboard.getOverview>;
  /**
   * Preloaded canonical subject list. The `enrolled` flag
   * on each entry determines whether EmptySubjectsState
   * renders the chip as addable (with the "+" button) or
   * as already-enrolled.
   */
  readonly subjectsPreloaded: Preloaded<typeof api.subjects.list>;
  readonly fallbackName: string;
}) {
  const data = usePreloadedQuery(preloaded);
  const subjects = usePreloadedQuery(subjectsPreloaded);

  // Map the canonical subjects shape into the lighter
  // shape `EmptySubjectsState` needs (id, slug, title,
  // color, icon, enrolled, topicCount). Memoised on the
  // `subjects` array reference so Convex's reactive
  // re-render after an enroll click does not re-allocate
  // a fresh array on every parent tick — without this
  // the inline EmptySubjectsState subtree re-renders the
  // whole subject list on each cockpit revalidation,
  // which is wasted work when the user is mid-scroll.
  const pickableSubjects = useMemo(
    () =>
      subjects.map((s) => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        color: s.color,
        icon: s.icon,
        enrolled: s.enrolled,
        topicCount: s.topicCount,
      })),
    [subjects]
  );

  if (data.isEmpty) {
    return (
      <EmptySubjectsState
        userName={data.user?.name ?? fallbackName}
        availableSubjects={pickableSubjects}
      />
    );
  }

  return (
    <>
      <CockpitStatsRow
        dueToday={data.stats.dueToday}
        streakDays={data.stats.streakDays}
        overallMastery={data.stats.overallMastery}
      />
      <SubjectMasteryStrip subjects={data.subjects} />
    </>
  );
}

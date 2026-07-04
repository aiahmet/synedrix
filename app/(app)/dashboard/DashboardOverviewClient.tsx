"use client";

import { Preloaded, usePreloadedQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { CockpitStatsRow } from "@/components/dashboard/CockpitStatsRow";
import { SubjectMasteryStrip } from "@/components/dashboard/SubjectMasteryStrip";
import { EmptySubjectsState } from "@/components/dashboard/EmptySubjectsState";

/**
 * DashboardOverviewClient.
 *
 * The only client island on the dashboard page. Subscribes to the
 * preloaded Convex query and switches between the populated
 * cockpit (stats row + mastery strip) and the empty state based
 * on `isEmpty`.
 *
 * The component is intentionally tiny. All the visual language
 * lives in the server-rendered child components so the cockpit
 * reads as a single design system even before hydration.
 */
export function DashboardOverviewClient({
  preloaded,
  fallbackName,
}: {
  readonly preloaded: Preloaded<typeof api.dashboard.getOverview>;
  readonly fallbackName: string;
}) {
  const data = usePreloadedQuery(preloaded);

  if (data.isEmpty) {
    return <EmptySubjectsState userName={data.user?.name ?? fallbackName} />;
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

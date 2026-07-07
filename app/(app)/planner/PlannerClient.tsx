"use client";

import { usePreloadedQuery } from "convex/react";
import { Preloaded } from "convex/react";

import { api } from "@/convex/_generated/api";
import { PlannerHeader } from "@/components/planner/PlannerHeader";
import { RecoveryPlanCard } from "@/components/planner/RecoveryPlanCard";
import { GoalsPanel } from "@/components/planner/GoalsPanel";
import { NextBestPanel } from "@/components/planner/NextBestPanel";
import { OverdueTopicsPanel } from "@/components/planner/OverdueTopicsPanel";
import { SessionTemplatesPanel } from "@/components/planner/SessionTemplatesPanel";

export function PlannerClient({
  preloaded,
  recoveryPreloaded,
}: {
  readonly preloaded: Preloaded<typeof api.planner.getPlannerOverview>;
  readonly recoveryPreloaded: Preloaded<typeof api.planner.getRecoveryPlan>;
}) {
  const data = usePreloadedQuery(preloaded);
  const recovery = usePreloadedQuery(recoveryPreloaded);

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-8">
      <PlannerHeader stats={data.weeklyStats} />
      {recovery.isRecoveryNeeded && recovery.plan && (
        <RecoveryPlanCard plan={recovery.plan} missedDays={recovery.missedDaysCount} />
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <GoalsPanel goals={data.goals} />
        <NextBestPanel nextBest={data.nextBest} />
      </div>
      <OverdueTopicsPanel topics={data.overdueTopics} />
      <SessionTemplatesPanel templates={data.templates} />
    </div>
  );
}

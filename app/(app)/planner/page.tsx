import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { Preloaded } from "convex/react";

import { api } from "@/convex/_generated/api";
import { ensureSeedBootstrapped } from "@/lib/server/bootstrapSeed";
import { PlannerClient } from "./PlannerClient";

export default async function PlannerPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");

  const token = await getToken({ template: "convex" }).catch(() => null);

  await ensureSeedBootstrapped();

  let preloaded: Preloaded<typeof api.planner.getPlannerOverview> | null = null;
  let recoveryPreloaded: Preloaded<typeof api.planner.getRecoveryPlan> | null = null;
  let isConvexConfigured = true;

  try {
    [preloaded, recoveryPreloaded] = await Promise.all([
      preloadQuery(api.planner.getPlannerOverview, {}, token ? { token } : {}),
      preloadQuery(api.planner.getRecoveryPlan, {}, token ? { token } : {}),
    ]);
  } catch {
    isConvexConfigured = false;
  }

  if (!isConvexConfigured || !preloaded || !recoveryPreloaded) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Planner could not load. Make sure Convex is running.
        </p>
      </div>
    );
  }

  return (
    <PlannerClient
      preloaded={preloaded}
      recoveryPreloaded={recoveryPreloaded}
    />
  );
}

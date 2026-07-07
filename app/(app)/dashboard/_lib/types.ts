import type { Preloaded } from "convex/react";
import type { api } from "@/convex/_generated/api";

export interface Tier0Preloads {
  readonly overview: Preloaded<typeof api.dashboard.getOverview>;
  readonly subjects: Preloaded<typeof api.subjects.list>;
}

export interface Tier1Preloads {
  readonly continueStudying: Preloaded<typeof api.dashboard.getContinueStudying>;
  readonly recentActivity: Preloaded<typeof api.dashboard.getRecentActivity>;
  readonly whatsNew: Preloaded<typeof api.telemetry.getRecentSystemUpdates>;
  readonly ownedTopics: Preloaded<typeof api.dashboard.listOwnedTopicsForCurrentUser>;
  readonly dailyMission: Preloaded<typeof api.dashboard.getDailyMission> | null;
  readonly weeklyConsistency: Preloaded<typeof api.dashboard.getWeeklyConsistency> | null;
}

export interface Tier2Preloads {
  readonly mistakesRevisit: Preloaded<typeof api.dashboard.getMistakesToRevisit> | null;
  readonly goalsSnapshot: Preloaded<typeof api.goals.getSnapshot> | null;
  readonly recoveredTopics: Preloaded<typeof api.dashboard.getRecoveredTopics> | null;
  readonly timeBySubject: Preloaded<typeof api.dashboard.getTimeBySubject> | null;
}

import type { Id } from "../_generated/dataModel";

// Re-export from recommendNextBest to avoid duplication
export type { NextBestRecommendation } from "./recommendNextBest";

export interface WeeklyStats {
  readonly totalMinutes: number;
  readonly totalSessions: number;
  readonly streakDays: number;
  readonly goalCompletionRate: number;
}

export interface EnrichedGoal {
  readonly id: Id<"goals">;
  readonly title: string;
  readonly type: "daily" | "weekly";
  readonly targetCount: number | null;
  readonly completedCount: number;
  readonly deadline: number | null;
  readonly subjectTitle: string | null;
  readonly subjectColor: string | null;
}

export interface GoalSnapshotDaily {
  readonly id: Id<"goals">;
  readonly title: string;
  readonly targetCount: number | null;
  readonly completedCount: number;
  readonly subjectTitle: string | null;
  readonly subjectColor: string | null;
}

export interface GoalSnapshotWeekly extends GoalSnapshotDaily {
  readonly deadline: number | null;
}

export interface EnrichedTemplate {
  readonly id: Id<"sessionTemplates">;
  readonly title: string;
  readonly description: string | null;
  readonly subjectId: Id<"subjects"> | null;
  readonly subjectTitle: string | null;
  readonly subjectColor: string | null;
  readonly intentionHint: string | null;
  readonly targetMinutes: number | null;
}

export interface OverdueTopic {
  readonly id: Id<"topics">;
  readonly slug: string;
  readonly title: string;
  readonly subjectTitle: string;
  readonly subjectSlug: string;
  readonly subjectColor: string | null;
  readonly chapterSlug: string;
  readonly mastery: number;
  readonly lastStudied: number | null;
  readonly daysSinceStudy: number | null;
}

export interface PriorityTopic {
  readonly title: string;
  readonly slug: string;
  readonly subjectTitle: string;
  readonly subjectSlug: string;
  readonly subjectColor: string | null;
  readonly chapterSlug: string;
  readonly mastery: number;
  readonly daysSinceStudy: number;
  readonly reason: string;
}

export interface RecoveryPlan {
  readonly overdueCount: number;
  readonly totalTopics: number;
  readonly suggestedSessionMinutes: number;
  readonly priorityTopics: readonly PriorityTopic[];
  readonly narrative: string;
}

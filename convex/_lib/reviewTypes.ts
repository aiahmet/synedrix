// convex/_lib/reviewTypes.ts
import type { Id } from "../_generated/dataModel";

export type ReviewItemKind =
  | "flashcard"
  | "mistake"
  | "weak_topic"
  | "formula_pack"
  | "vocabulary_deck";

export interface QueueItem {
  readonly kind: ReviewItemKind;
  readonly priority: number;
  readonly at: number;
  readonly title: string;
  readonly subtitle: string;
  readonly href: string;
  readonly subjectSlug: string | null;
  readonly subjectColor: string | null;
  readonly count: number | null;
  readonly topicId: Id<"topics"> | null;
}

export interface QueueHeader {
  readonly overdueCount: number;
  readonly dueTodayCount: number;
  readonly weakTopicCount: number;
  readonly formulaPackCount: number;
  readonly vocabularyDeckCount: number;
  readonly hasRescuePlanEligible: boolean;
}

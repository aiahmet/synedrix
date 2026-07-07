import {
  ClockCounterClockwise,
  Lightning,
  Warning,
  Function,
  Translate,
} from "@phosphor-icons/react";

export type QueueItem = {
  readonly kind: "flashcard" | "mistake" | "weak_topic" | "formula_pack" | "vocabulary_deck";
  readonly priority: number;
  readonly at: number;
  readonly title: string;
  readonly subtitle: string;
  readonly href: string;
  readonly subjectSlug: string | null;
  readonly subjectColor: string | null;
  readonly count: number | null;
  readonly topicId: string | null;
};

export function resolveTone(color: string | null | undefined): string {
  if (!color) return "var(--color-accent)";
  return `var(--subject-${color})`;
}

export const kindMeta: Record<
  QueueItem["kind"],
  { icon: typeof ClockCounterClockwise; label: string }
> = {
  flashcard: { icon: ClockCounterClockwise, label: "Flashcard review" },
  mistake: { icon: Warning, label: "Mistake review" },
  weak_topic: { icon: Lightning, label: "Weak topic" },
  formula_pack: { icon: Function, label: "Formula sheet" },
  vocabulary_deck: { icon: Translate, label: "Vocabulary deck" },
};

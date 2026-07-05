"use client";

import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";
import { Cards } from "@/components/landing/icons";

/**
 * CanonicalFlashcardDeck.
 *
 * Shows a summary card for the canonical-baseline flashcard
 * deck on the topic page. Future: link to a flashcard review
 * page for this deck (the `deckId` is reserved for that
 * link's `href`; for v1 we surface the card count and a
 * descriptive line only).
 */
export function CanonicalFlashcardDeck({
  title,
  cardCount,
}: {
  /** `deckId` is reserved for the future flashcard review link. */
  readonly deckId?: string;
  readonly title: string;
  readonly cardCount: number;
}) {
  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Flashcard deck"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {cardCount} cards
          </span>
        }
      />

      <p className="text-[12.5px] leading-relaxed text-muted-foreground mb-4">
        A pre-built flashcard deck covering key definitions, formulas, and
        concepts for this topic. Review in the spaced-repetition queue to
        lock in long-term retention.
      </p>

      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-elevated p-3">
        <Cards className="h-4 w-4 text-accent" weight="duotone" />
        <span className="text-[12.5px] font-medium text-foreground">
          {title}
        </span>
      </div>
    </CockpitCard>
  );
}

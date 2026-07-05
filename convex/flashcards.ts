/**
 * flashcards.ts.
 *
 * Per-topic canonical-baseline flashcard deck queries.
 * The existing `flashcardDecks` and `flashcards` tables
 * are reused; the `source: "canonical_baseline"` discriminator
 * separates pre-seeded content from user-generated decks.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";


/**
 * getCanonicalDeck.
 *
 * Returns the canonical-baseline flashcard deck for a
 * given topic, or null if none exists. Auth-optional.
 */
export const getCanonicalDeck = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, { topicId }) => {
    const decks = await ctx.db
      .query("flashcardDecks")
      .withIndex("by_topic_source", (q) =>
        q.eq("topicId", topicId).eq("source", "canonical_baseline")
      )
      .collect();
    if (decks.length === 0) return null;

    const deck = decks[0];
    const cards = await ctx.db
      .query("flashcards")
      .withIndex("by_deck", (q) => q.eq("deckId", deck._id))
      .collect();
    cards.sort((a, b) => a.order - b.order);

    return {
      id: deck._id,
      topicId: deck.topicId,
      title: deck.title,
      description: deck.description,
      cardCount: cards.length,
      cards: cards.map((c) => ({
        id: c._id,
        front: c.front,
        back: c.back,
        order: c.order,
      })),
    };
  },
});

/**
 * listByTopic.
 *
 * Returns all flashcard decks for a topic (canonical
 * and user-generated). Auth-optional.
 */
export const listByTopic = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, { topicId }) => {
    const decks = await ctx.db
      .query("flashcardDecks")
      .withIndex("by_topic", (q) => q.eq("topicId", topicId))
      .collect();

    return decks.map((d) => ({
      id: d._id,
      title: d.title,
      description: d.description,
      source: (d.source ?? "canonical") as string,
    }));
  },
});

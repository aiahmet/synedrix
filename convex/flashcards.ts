/**
 * flashcards.ts.
 *
 * Per-topic canonical-baseline flashcard deck queries.
 * The existing `flashcardDecks` and `flashcards` tables
 * are reused; the `source: "canonical_baseline"` discriminator
 * separates pre-seeded content from user-generated decks.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

import { requireUser } from "./users";


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

/**
 * generateFromMessage.
 *
 * Phase 6 §8.2: called by the `/api/tutor/flashcards` route
 * handler after the AI has extracted key term/definition
 * pairs from the message text. Atomically writes:
 *
 *   - a `flashcardDecks` row (source: "user")
 *   - N `flashcards` rows
 *
 * The caller (route handler) is responsible for the AI
 * extraction — this mutation is pure persistence.
 *
 * `topicId` is the subject-level topic the flashcards
 * are associated with (for per-topic deck listing).
 */
export const generateFromMessage = mutation({
  args: {
    topicId: v.id("topics"),
    title: v.string(),
    cards: v.array(
      v.object({
        front: v.string(),
        back: v.string(),
      })
    ),
  },
  returns: v.object({
    deckId: v.id("flashcardDecks"),
    cardCount: v.number(),
  }),
  handler: async (ctx, { topicId, title, cards }) => {
    const user = await requireUser(ctx);

    if (cards.length === 0) {
      throw new Error("cards_must_not_be_empty");
    }

    const deckId = await ctx.db.insert("flashcardDecks", {
      topicId,
      title,
      generatedById: user._id,
      source: "user",
    });

    for (let i = 0; i < cards.length; i++) {
      await ctx.db.insert("flashcards", {
        deckId,
        front: cards[i].front,
        back: cards[i].back,
        order: i,
      });
    }

    return { deckId, cardCount: cards.length };
  },
});

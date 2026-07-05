/**
 * topicResources.ts.
 *
 * Per-topic formula sheets and vocabulary decks.
 * Each topic has at most one of each `kind`; the
 * (topicId, kind) compound index enforces this at the
 * application level.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * getFormulaSheet.
 *
 * Returns the formula sheet for a given topic, or null
 * if the topic has no formula sheet. Auth-optional so
 * the topic page renders even without a Clerk JWT.
 */
export const getFormulaSheet = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, { topicId }) => {
    const rows = await ctx.db
      .query("topicResources")
      .withIndex("by_topic_kind", (q) =>
        q.eq("topicId", topicId).eq("kind", "formula_sheet")
      )
      .collect();
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row._id,
      contents: row.contents.map((c) => {
        if ("expression" in c && "when" in c) {
          return {
            name: c.name,
            expression: c.expression,
            when: c.when,
          };
        }
        return { name: "", expression: "", when: "" };
      }),
      language: row.language,
    };
  },
});

/**
 * getVocabularyDeck.
 *
 * Returns the vocabulary deck for a given topic, or null
 * if the topic has no vocabulary deck. Auth-optional.
 */
export const getVocabularyDeck = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, { topicId }) => {
    const rows = await ctx.db
      .query("topicResources")
      .withIndex("by_topic_kind", (q) =>
        q.eq("topicId", topicId).eq("kind", "vocabulary_deck")
      )
      .collect();
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row._id,
      contents: row.contents.map((c) => {
        if ("term" in c && "definition" in c) {
          return {
            term: c.term,
            definition: c.definition,
            gender: c.gender,
            example: c.example,
          };
        }
        return { term: "", definition: "" };
      }),
      language: row.language,
    };
  },
});

/**
 * listTopicResourceKinds.
 *
 * Returns which resource kinds exist for a topic so the
 * UI can conditionally render FormulaSheet vs VocabularyDeck.
 */
export const listTopicResourceKinds = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, { topicId }) => {
    const rows = await ctx.db
      .query("topicResources")
      .withIndex("by_topic", (q) => q.eq("topicId", topicId))
      .collect();
    return rows.map((r) => ({ kind: r.kind, id: r._id }));
  },
});

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import { requireUser, resolveUserReadOnly as resolveUser } from "./users";

/**
 * tutorPatterns.ts — Phase 2 §4.2 Mistake Pattern Detection.
 *
 * Lightweight pattern classifier that runs on `endSession`
 * and tags cross-mistake patterns:
 *
 *   - "sign_error_chain" — same sign error across 3+ topics
 *   - "formula_confusion" — mixing up two related formulas
 *   - "unit_conversion_gap" — struggling with units across
 *     physics + chemistry
 *   - "reading_comprehension" — misreading questions in
 *     language + math word problems
 *   - "recurring_mistake_type" — generic: same mistake type
 *     across 3+ distinct topics
 *   - "cross_topic_weakness" — a topic-level gap that shows
 *     up in another topic's mistakes
 *
 * Detected patterns are persisted in the `mistakePatterns`
 * table, surfaced in the Memory panel, and injected into
 * the tutor system prompt so the model can reference them
 * naturally.
 */

// ── Queries ───────────────────────────────────────────────

/**
 * Returns all unresolved patterns for the current user.
 * Used by the Memory panel to render pattern cards.
 */
export const getMyPatterns = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("mistakePatterns"),
      patternType: v.string(),
      mistakeType: v.string(),
      topicCount: v.number(),
      description: v.string(),
      detectedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const user = await resolveUser(ctx);
    if (!user) return [];

    const patterns = await ctx.db
      .query("mistakePatterns")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return patterns
      .filter((p) => p.resolvedAt === undefined)
      .sort((a, b) => b.detectedAt - a.detectedAt)
      .map((p) => ({
        id: p._id,
        patternType: p.patternType,
        mistakeType: p.mistakeType,
        topicCount: p.topicCount,
        description: p.description,
        detectedAt: p.detectedAt,
      }));
  },
});

/**
 * Returns a compact text block describing the user's
 * active patterns for injection into the tutor system
 * prompt. Returns an empty string when no patterns
 * exist.
 *
 * This is callable from the route handler via
 * `api.tutorPatterns.getActivePatternsForPrompt`.
 */
export const getActivePatternsForPrompt = query({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const user = await resolveUser(ctx);
    if (!user) return "";

    const patterns = await ctx.db
      .query("mistakePatterns")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const active = patterns.filter((p) => p.resolvedAt === undefined);
    if (active.length === 0) return "";

    const lines = active.map((p) => {
      const label = PATTERN_LABELS[p.patternType] ?? p.patternType;
      return `  - ${label}: ${p.description} (across ${p.topicCount} topics, ${p.mistakeType})`;
    });

    return (
      "== Detected learning patterns (use these to focus your teaching) ==\n" +
      lines.join("\n") +
      "\n"
    );
  },
});

// ── Mutations ─────────────────────────────────────────────

/**
 * Detects cross-topic mistake patterns for the current user.
 * Called from `endSession` in `convex/tutor.ts` after the
 * session is closed and mastery is updated.
 *
 * The detection is intentionally simple and heuristic-based
 * (no AI call):
 *
 *   1. Load all the user's mistake entries across all topics.
 *   2. Group by `mistakeType`.
 *   3. If a `mistakeType` appears across 3+ distinct topics,
 *      record a `recurring_mistake_type` pattern.
 *   4. If `CALCULATION_MISTAKE` appears across 3+ distinct
 *      topics, record a `sign_error_chain` pattern (heuristic:
 *      the most common calculation mistake in math/physics is
 *      a sign error).
 *   5. If `MISREAD_QUESTION` appears across 2+ distinct
 *      topics that span different subjects, record a
 *      `reading_comprehension` pattern.
 *
 * Idempotent: skips patterns that are already recorded
 * (same patternType + same set of topicIds for the user).
 */
export const detect = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // 1. Load all mistake entries for this user.
    const allMistakes = await ctx.db
      .query("mistakeEntries")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (allMistakes.length < 3) return 0;

    // 2. Group by mistakeType, collecting distinct topicIds.
    type MistakeGroup = {
      topicIds: Set<Id<"topics">>;
      examples: string[];
    };
    const byType = new Map<string, MistakeGroup>();
    for (const m of allMistakes) {
      const existing = byType.get(m.mistakeType);
      const group: MistakeGroup = existing ?? {
        topicIds: new Set<Id<"topics">>(),
        examples: [],
      };
      if (m.topicId) group.topicIds.add(m.topicId);
      if (group.examples.length < 3) {
        group.examples.push(m.question.slice(0, 80));
      }
      byType.set(m.mistakeType, group);
    }

    // 3. Load existing patterns to avoid duplicates.
    const existingPatterns = await ctx.db
      .query("mistakePatterns")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const existingKeys = new Set(
      existingPatterns
        .filter((p) => p.resolvedAt === undefined)
        .map((p) => `${p.patternType}:${[...p.topicIds].sort().join(",")}`)
    );

    let inserted = 0;

    // 4. Detect recurring_mistake_type patterns.
    for (const [mistakeType, group] of byType) {
      if (group.topicIds.size < 3) continue;
      const topicIds = [...group.topicIds];
      const key = `recurring_mistake_type:${topicIds.sort().join(",")}`;
      if (existingKeys.has(key)) continue;

      const humanLabel = MISTAKE_TYPE_LABEL[mistakeType] ?? mistakeType;
      await ctx.db.insert("mistakePatterns", {
        userId: user._id,
        patternType: "recurring_mistake_type",
        mistakeType,
        topicIds,
        topicCount: topicIds.length,
        description: `Same ${humanLabel} pattern detected across ${topicIds.length} different topics. This is a transfer-level gap — the underlying skill hasn't generalised yet.`,
        detectedAt: now,
      });
      inserted += 1;
    }

    // 5. Sign error chain: CALCULATION_MISTAKE across 3+ topics.
    const calcGroup = byType.get("CALCULATION_MISTAKE");
    if (calcGroup && calcGroup.topicIds.size >= 3) {
      const topicIds = [...calcGroup.topicIds];
      const key = `sign_error_chain:${topicIds.sort().join(",")}`;
      if (!existingKeys.has(key)) {
        await ctx.db.insert("mistakePatterns", {
          userId: user._id,
          patternType: "sign_error_chain",
          mistakeType: "CALCULATION_MISTAKE",
          topicIds,
          topicCount: topicIds.length,
          description:
            "Frequent calculation mistakes across multiple topics — most often sign errors or algebraic slips that recur when the student switches context.",
          detectedAt: now,
        });
        inserted += 1;
      }
    }

    // 6. Reading comprehension: MISREAD_QUESTION across 2+ topics
    //    in different subjects.
    const misreadGroup = byType.get("MISREAD_QUESTION");
    if (misreadGroup && misreadGroup.topicIds.size >= 2) {
      const topicIds = [...misreadGroup.topicIds];
      // Check if they span different subjects.
      const topicRows = await Promise.all(
        topicIds.map((id) => ctx.db.get(id))
      );
      const chapterRows = await Promise.all(
        topicRows
          .filter((t): t is NonNullable<typeof t> => t !== null)
          .map((t) => ctx.db.get(t.chapterId))
      );
      const subjects = new Set(
        chapterRows
          .filter((c): c is NonNullable<typeof c> => c !== null)
          .map((c) => c.subjectId)
      );
      if (subjects.size >= 2) {
        const key = `reading_comprehension:${topicIds.sort().join(",")}`;
        if (!existingKeys.has(key)) {
          await ctx.db.insert("mistakePatterns", {
            userId: user._id,
            patternType: "reading_comprehension",
            mistakeType: "MISREAD_QUESTION",
            topicIds,
          topicCount: topicIds.length,
          description:
            "Misreading questions across different subjects — this is a comprehension strategy gap, not a subject-knowledge gap. Focus on deliberate question-parsing techniques.",
            detectedAt: now,
          });
          inserted += 1;
        }
      }
    }

    return inserted;
  },
});

/**
 * Resolves a pattern (marks it as addressed). Called when
 * the user has demonstrably improved across the flagged
 * topics.
 */
export const resolve = mutation({
  args: {
    patternId: v.id("mistakePatterns"),
  },
  returns: v.null(),
  handler: async (ctx, { patternId }) => {
    const user = await requireUser(ctx);
    const pattern = await ctx.db.get(patternId);
    if (!pattern || pattern.userId !== user._id) {
      throw new Error("Forbidden");
    }
    if (pattern.resolvedAt !== undefined) return null;
    await ctx.db.patch(patternId, { resolvedAt: Date.now() });
    return null;
  },
});

// ── Labels ────────────────────────────────────────────────

const PATTERN_LABELS: Record<string, string> = {
  sign_error_chain: "Sign error chain",
  formula_confusion: "Formula confusion",
  unit_conversion_gap: "Unit conversion gap",
  reading_comprehension: "Reading comprehension gap",
  recurring_mistake_type: "Recurring mistake",
  cross_topic_weakness: "Cross-topic weakness",
};

const MISTAKE_TYPE_LABEL: Record<string, string> = {
  CONCEPT_MISUNDERSTANDING: "conceptual misunderstanding",
  CALCULATION_MISTAKE: "calculation mistake",
  CARELESS_ERROR: "careless error",
  FORMULA_RECALL_FAILURE: "formula recall failure",
  MISREAD_QUESTION: "question misread",
  LANGUAGE_EXPRESSION_ISSUE: "language expression issue",
};

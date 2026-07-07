import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import { requireUser, resolveUserReadOnly as resolveUser } from "./users";
import {
  scoreToGermanGrade,
  type GermanLetterGrade,
} from "./_lib/grading";

/**
 * tutorPractice.ts — Phase 3 §5.2.
 *
 * Persistence layer for the inline tutor practice feature.
 * The architecture is intentional:
 *
 *   - Standard practiceSets / practiceItems / practiceAttempts
 *     tables carry the items + per-attempt grading state so
 *     the inline practice NATIVELY feeds the existing
 *     mastery curve (no bespoke mastery wiring needed).
 *     Inline-generated rows are flagged `source:
 *     "inline_tutor"` on the `practiceSets` row so we can
 *     filter / chart the volume later.
 *
 *   - This file adds the `inlineTutorSessions` table for
 *     SESSION-level state (timeline anchor, completion,
 *     aggregate score) and the
 *     `practiceAttempts.practiceItemId` link via
 *     `practiceItems.practiceSetId === session.practiceSetId`.
 *
 * AI calls happen in the route handlers
 * (`app/api/tutor/practice/*`); this module is pure
 * persistence, matching the pattern in `convex/practice.ts`.
 */

const verdictArg = v.union(
  v.literal("correct"),
  v.literal("partially_correct"),
  v.literal("incorrect")
);

const gradeArg = v.union(
  v.literal("1"),
  v.literal("2"),
  v.literal("3"),
  v.literal("4"),
  v.literal("5"),
  v.literal("6")
);

const practiceItemShapeArg = v.object({
  prompt: v.string(),
  expectedAnswer: v.string(),
  skill: v.string(),
  rubric: v.array(v.string()),
});

const gradeShapeArg = v.object({
  verdict: verdictArg,
  score: v.number(),
  feedback: v.string(),
  betterAnswer: v.string(),
  mistakeType: v.union(
    v.union(
      v.literal("CONCEPT_MISUNDERSTANDING"),
      v.literal("CALCULATION_MISTAKE"),
      v.literal("CARELESS_ERROR"),
      v.literal("FORMULA_RECALL_FAILURE"),
      v.literal("MISREAD_QUESTION"),
      v.literal("LANGUAGE_EXPRESSION_ISSUE"),
      v.literal("SIGN_ERROR"),
      v.literal("UNIT_CONVERSION_ERROR"),
      v.literal("GRAMMAR_ERROR"),
      v.literal("VOCABULARY_ERROR"),
      v.literal("REACTION_BALANCE_ERROR"),
      v.literal("ARGUMENT_STRUCTURE_ISSUE")
    ),
    v.null()
  ),
  cause: v.union(v.string(), v.null()),
});

// ── Queries ───────────────────────────────────────────────

/**
 * All inline sessions started in this thread, ordered by
 * `startedAt` ascending. Used by MessageList to render
 * each session as a tile anchored to its `anchorMessageId`.
 */
export const getInlineSessionsForThread = query({
  args: { threadId: v.id("tutorThreads") },
  returns: v.array(
    v.object({
      id: v.id("inlineTutorSessions"),
      threadId: v.id("tutorThreads"),
      subjectId: v.id("subjects"),
      topicId: v.union(v.id("topics"), v.null()),
      practiceSetId: v.id("practiceSets"),
      anchorMessageId: v.string(),
      startedAt: v.number(),
      completedAt: v.union(v.number(), v.null()),
      overallScore: v.union(v.number(), v.null()),
      grade: v.union(gradeArg, v.null()),
    })
  ),
  handler: async (ctx, { threadId }) => {
    const start = Date.now();
    const user = await resolveUser(ctx);
    if (!user) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getInlineSessionsForThread took ${ms}ms`);
      return [];
    }

    // The thread id is not user-scoped (we store the thread
    // row id), so we have to verify ownership through the
    // thread row before reading session data.
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.userId !== user._id) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getInlineSessionsForThread took ${ms}ms`);
      return [];
    }

    const sessions = await ctx.db
      .query("inlineTutorSessions")
      .withIndex("by_thread_started", (q) => q.eq("threadId", threadId))
      .collect();
    const result = sessions
      .map((s) => ({
        id: s._id,
        threadId: s.threadId,
        subjectId: s.subjectId,
        topicId: s.topicId ?? null,
        practiceSetId: s.practiceSetId,
        anchorMessageId: s.anchorMessageId,
        startedAt: s.startedAt,
        completedAt: s.completedAt ?? null,
        overallScore: s.overallScore ?? null,
        grade: s.grade ?? null,
      }))
      .sort((a, b) => a.startedAt - b.startedAt);
    const ms = Date.now() - start;
    if (ms > 500) console.warn(`[tutor-telemetry] getInlineSessionsForThread took ${ms}ms`);
    return result;
  },
});

/**
 * Single-session detail used by the InlinePractice
 * component to render the full per-item view. Returns
 * the session shell + every item in the linked practice
 * set + the latest attempt per item (if any) + the
 * mistake entry (if any).
 */
export const getInlineSessionForRunner = query({
  args: { sessionId: v.id("inlineTutorSessions") },
  returns: v.union(
    v.object({
      session: v.object({
        id: v.id("inlineTutorSessions"),
        threadId: v.id("tutorThreads"),
        subjectId: v.id("subjects"),
        topicId: v.union(v.id("topics"), v.null()),
        startedAt: v.number(),
        completedAt: v.union(v.number(), v.null()),
        overallScore: v.union(v.number(), v.null()),
        grade: v.union(gradeArg, v.null()),
      }),
      items: v.array(
        v.object({
          itemId: v.id("practiceItems"),
          order: v.number(),
          prompt: v.string(),
          expectedAnswer: v.string(),
          skill: v.string(),
          rubric: v.array(v.string()),
          attempt: v.union(
            v.object({
              attemptId: v.id("practiceAttempts"),
              userAnswer: v.string(),
              verdict: verdictArg,
              score: v.number(),
              feedback: v.string(),
              betterAnswer: v.string(),
              attemptedAt: v.number(),
            }),
            v.null()
          ),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, { sessionId }) => {
    const start = Date.now();
    const user = await resolveUser(ctx);
    if (!user) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getInlineSessionForRunner took ${ms}ms`);
      return null;
    }
    const session = await ctx.db.get(sessionId);
    if (!session) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getInlineSessionForRunner took ${ms}ms`);
      return null;
    }

    // Ownership chain: session.threadId -> thread.userId
    // (the thread is the durable ownership surface, the
    // session is just a derived view).
    const thread = await ctx.db.get(session.threadId);
    if (!thread || thread.userId !== user._id) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getInlineSessionForRunner took ${ms}ms`);
      return null;
    }

    const items = await ctx.db
      .query("practiceItems")
      .withIndex("by_practice_set", (q) =>
        q.eq("practiceSetId", session.practiceSetId)
      )
      .collect();
    items.sort((a, b) => a.order - b.order);

    // Join latest attempt per item for the same user. We
    // use the per-user / per-item compound index
    // (`practiceAttempts.by_user_practice_item`) so the
    // query is O(1) per item instead of scanning every
    // attempt the user has ever submitted. The previous
    // `.query("practiceAttempts").withIndex("by_user")
    // .collect()` pattern grew without bound as the
    // user's history expanded.
    const latestByItem = new Map<
      Id<"practiceItems">,
      Awaited<ReturnType<typeof ctx.db.get<"practiceAttempts">>>
    >();
    for (const item of items) {
      const attempt = await ctx.db
        .query("practiceAttempts")
        .withIndex("by_user_practice_item", (q) =>
          q.eq("userId", user._id).eq("practiceItemId", item._id)
        )
        .order("desc")
        .first();
      if (attempt) latestByItem.set(item._id, attempt);
    }

    const result = {
      session: {
        id: session._id,
        threadId: session.threadId,
        subjectId: session.subjectId,
        topicId: session.topicId ?? null,
        startedAt: session.startedAt,
        completedAt: session.completedAt ?? null,
        overallScore: session.overallScore ?? null,
        grade: session.grade ?? null,
      },
      items: items.map((item) => {
        const attempt = latestByItem.get(item._id) ?? null;
        return {
          itemId: item._id,
          order: item.order,
          prompt: item.question,
          expectedAnswer: item.answer,
          skill: item.skills[0] ?? "allgemein",
          rubric: item.rubric ?? [],
          attempt: attempt
            ? {
                attemptId: attempt._id,
                userAnswer: attempt.userAnswer,
                verdict: attempt.verdict,
                score: attempt.score,
                feedback: attempt.feedback ?? "",
                betterAnswer: attempt.betterAnswer ?? item.answer,
                attemptedAt: attempt.attemptedAt,
              }
            : null,
        };
      }),
    };
    const ms = Date.now() - start;
    if (ms > 500) console.warn(`[tutor-telemetry] getInlineSessionForRunner took ${ms}ms`);
    return result;
  },
});

// ── Mutations ─────────────────────────────────────────────

/**
 * createInlineSession.
 *
 * Called by the `/api/tutor/practice` route handler
 * after the AI has produced the validated practice-item
 * bundle. Atomically writes:
 *
 *   - the `practiceSets` row (source: "inline_tutor")
 *   - the N `practiceItems` rows
 *   - the `inlineTutorSessions` row that anchors the
 *     session in the chat timeline
 *
 * Ownership check: the thread must belong to the caller.
 * The threadId is the durable anchor — we never create a
 * session against a thread the caller does not own.
 */
export const createInlineSession = mutation({
  args: {
    threadId: v.id("tutorThreads"),
    subjectId: v.id("subjects"),
    topicId: v.optional(v.id("topics")),
    anchorMessageId: v.string(),
    topicTitle: v.string(),
    items: v.array(practiceItemShapeArg),
  },
  returns: v.object({
    sessionId: v.id("inlineTutorSessions"),
    practiceSetId: v.id("practiceSets"),
    itemIds: v.array(v.id("practiceItems")),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new ConvexError("thread_not_found");
    if (thread.userId !== user._id) {
      throw new ConvexError("forbidden");
    }

    if (args.items.length === 0) {
      throw new ConvexError("practice_items_empty");
    }

    // We need a topicId to anchor the practiceSet row.
    // Falls back to a per-subject "Tutor inline practice"
    // set of zero real exercise if undefined, so the
    // schema never breaks; in the route handler we always
    // have a topicId when one exists.
    if (args.topicId === undefined) {
      throw new ConvexError(
        "topic_id_required_for_inline_practice (subject-only threads cannot generate inline practice yet)"
      );
    }
    const topic = await ctx.db.get(args.topicId);
    if (!topic) throw new ConvexError("topic_not_found");

    const practiceSetId = await ctx.db.insert("practiceSets", {
      topicId: args.topicId,
      title: `Inline — ${args.topicTitle}`,
      difficulty: topic.difficulty,
      generatedById: user._id,
      createdAt: Date.now(),
      // Discriminator added to the schema in Phase 3 §5.2.
      source: "inline_tutor",
    });

    const itemIds: Array<Id<"practiceItems">> = [];
    for (let i = 0; i < args.items.length; i++) {
      const it = args.items[i];
      const id = await ctx.db.insert("practiceItems", {
        practiceSetId,
        // Inline practice is open-prose by design — the
        // student writes the answer in the tutor, not on a
        // canonical multiple-choice page.
        type: "user_text_answer",
        question: it.prompt,
        answer: it.expectedAnswer,
        explanation: it.expectedAnswer,
        skills: [it.skill],
        order: i,
        // We leave `source: undefined` here intentionally —
        // the discriminator is on the parent practiceSet
        // row, and `practiceItems.source` only discriminates
        // the canonical/user_lesson/canonical_baseline
        // lineage. Adding "inline_tutor" to that union would
        // be redundant with the parent set + a future schema
        // migration if we ever want deeper filtering.
        rubric: it.rubric,
      });
      itemIds.push(id);
    }

    const sessionId = await ctx.db.insert("inlineTutorSessions", {
      threadId: args.threadId,
      subjectId: args.subjectId,
      topicId: args.topicId,
      practiceSetId,
      anchorMessageId: args.anchorMessageId,
      startedAt: Date.now(),
    });

    return { sessionId, practiceSetId, itemIds };
  },
});

/**
 * recordInlineAttempt.
 *
 * Called by the `/api/tutor/practice/grade` route handler
 * after AI grading. Persists:
 *
 *   - the `practiceAttempts` row (joins practiceItems
 *     through `practiceItemId`)
 *   - the `mistakeEntries` row when verdict !== "correct"
 *
 * Does NOT advance the session-level `completedAt` /
 * `overallScore` — that happens in a separate
 * `endInlineSession` call when the runner has answered
 * every item (or when the user closes mid-run).
 */
export const recordInlineAttempt = mutation({
  args: {
    sessionId: v.id("inlineTutorSessions"),
    itemId: v.id("practiceItems"),
    userAnswer: v.string(),
    grade: gradeShapeArg,
  },
  returns: v.object({
    attemptId: v.id("practiceAttempts"),
    verdict: verdictArg,
    score: v.number(),
    feedback: v.string(),
    betterAnswer: v.string(),
    mistakeEntryId: v.union(v.id("mistakeEntries"), v.null()),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new ConvexError("session_not_found");
    const thread = await ctx.db.get(session.threadId);
    if (!thread || thread.userId !== user._id) {
      throw new ConvexError("forbidden");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new ConvexError("item_not_found");
    if (item.practiceSetId !== session.practiceSetId) {
      throw new ConvexError("item_does_not_belong_to_session");
    }

    const trimmed = args.userAnswer.trim();
    if (trimmed.length === 0) {
      throw new ConvexError("empty_answer");
    }

    // Same verdict/mistakeType invariant as
    // `submitAnswerAndGrade`. A correct verdict cannot have
    // a tagged mistake; a non-correct verdict must.
    if (
      args.grade.verdict === "correct" &&
      (args.grade.mistakeType !== null || args.grade.cause !== null)
    ) {
      throw new ConvexError("invariant_verdict_mistakeType");
    }
    if (
      args.grade.verdict !== "correct" &&
      args.grade.mistakeType === null
    ) {
      throw new ConvexError("invariant_mistakeType_required");
    }

    const attemptId = await ctx.db.insert("practiceAttempts", {
      userId: user._id,
      practiceItemId: args.itemId,
      userAnswer: trimmed,
      verdict: args.grade.verdict,
      score: args.grade.score,
      feedback: args.grade.feedback,
      betterAnswer: args.grade.betterAnswer,
      attemptedAt: Date.now(),
    });

    let mistakeEntryId: Id<"mistakeEntries"> | null = null;
    if (
      args.grade.verdict !== "correct" &&
      args.grade.mistakeType !== null &&
      session.topicId !== undefined
    ) {
      mistakeEntryId = await ctx.db.insert("mistakeEntries", {
        userId: user._id,
        topicId: session.topicId,
        practiceAttemptId: attemptId,
        question: item.question,
        userAnswer: trimmed,
        correctAnswer: args.grade.betterAnswer,
        mistakeType: args.grade.mistakeType,
        ...(args.grade.cause !== null && args.grade.cause.length > 0
          ? { cause: args.grade.cause }
          : {}),
      });
    }

    return {
      attemptId,
      verdict: args.grade.verdict,
      score: args.grade.score,
      feedback: args.grade.feedback,
      betterAnswer: args.grade.betterAnswer,
      mistakeEntryId,
    };
  },
});

/**
 * endInlineSession.
 *
 * Marks the inline session as completed + computes the
 * mean score across `practiceAttempts` for this session's
 * practiceSet and the German 1-6 letter grade.
 *
 * Idempotent on re-end: subsequent calls re-compute and
 * overwrite `overallScore` / `grade` from the latest
 * attempt per item. If the user abandoned the run after
 * answering only some items, the row is still marked
 * `completedAt` set so it disappears from "active" reads
 * in the UI.
 */
export const endInlineSession = mutation({
  args: { sessionId: v.id("inlineTutorSessions") },
  returns: v.union(
    v.object({
      sessionId: v.id("inlineTutorSessions"),
      overallScore: v.number(),
      grade: gradeArg,
      answeredCount: v.number(),
      itemCount: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, { sessionId }) => {
    const user = await requireUser(ctx);

    const session = await ctx.db.get(sessionId);
    if (!session) throw new ConvexError("session_not_found");
    const thread = await ctx.db.get(session.threadId);
    if (!thread || thread.userId !== user._id) {
      throw new ConvexError("forbidden");
    }

    const items = await ctx.db
      .query("practiceItems")
      .withIndex("by_practice_set", (q) =>
        q.eq("practiceSetId", session.practiceSetId)
      )
      .collect();

    // Per-item latest attempt lookup via the new
    // compound index — same per-item scan as
    // `getInlineSessionForRunner`. Symmetry across
    // queries keeps the read cost predictable as the
    // user's history grows.
    const latestByItem = new Map<
      Id<"practiceItems">,
      { score: number; attemptedAt: number }
    >();
    for (const item of items) {
      const attempt = await ctx.db
        .query("practiceAttempts")
        .withIndex("by_user_practice_item", (q) =>
          q.eq("userId", user._id).eq("practiceItemId", item._id)
        )
        .order("desc")
        .first();
      if (attempt) {
        latestByItem.set(item._id, {
          score: attempt.score,
          attemptedAt: attempt.attemptedAt,
        });
      }
    }

    // Always mark completedAt so the UI can hide the
    // "in progress" affordances, even if the user closed
    // mid-run without answering any item.
    const now = Date.now();
    if (latestByItem.size === 0) {
      // No attempts: zero the aggregate, do NOT set a
      // letter grade (a grade-less completion is honest).
      await ctx.db.patch(sessionId, {
        completedAt: now,
        overallScore: 0,
      });
      return {
        sessionId,
        overallScore: 0,
        // 6 ("ungenügend") is the honest floor when no
        // attempts were submitted before close.
        grade: "6" as GermanLetterGrade,
        answeredCount: 0,
        itemCount: items.length,
      };
    }

    const sum = Array.from(latestByItem.values()).reduce(
      (acc, e) => acc + e.score,
      0
    );
    const overallScore =
      items.length > 0 ? sum / items.length : sum / latestByItem.size;
    const grade: GermanLetterGrade = scoreToGermanGrade(overallScore);

    await ctx.db.patch(sessionId, {
      completedAt: now,
      overallScore,
      grade,
    });

    return {
      sessionId,
      overallScore,
      grade,
      answeredCount: latestByItem.size,
      itemCount: items.length,
    };
  },
});

/**
 * Helper for the grade route. Returns the per-item
 * grading input (prompt + expected answer + rubric) the
 * AI grader needs. Mirrors `getItemForGrading` from
 * `convex/practice.ts` but rooted in the inline session.
 */
export const getSubjectSlug = query({
  args: { subjectId: v.id("subjects") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { subjectId }) => {
    const start = Date.now();
    const subject = await ctx.db.get(subjectId);
    const result = subject?.slug ?? null;
    const ms = Date.now() - start;
    if (ms > 500) console.warn(`[tutor-telemetry] getSubjectSlug took ${ms}ms`);
    return result;
  },
});

export const getInlineItemForGrading = query({
  args: {
    sessionId: v.id("inlineTutorSessions"),
    itemId: v.id("practiceItems"),
  },
  returns: v.union(
    v.object({
      prompt: v.string(),
      expectedAnswer: v.string(),
      skill: v.string(),
      rubric: v.array(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, { sessionId, itemId }) => {
    const start = Date.now();
    const user = await resolveUser(ctx);
    if (!user) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getInlineItemForGrading took ${ms}ms`);
      return null;
    }
    const session = await ctx.db.get(sessionId);
    if (!session) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getInlineItemForGrading took ${ms}ms`);
      return null;
    }
    const thread = await ctx.db.get(session.threadId);
    if (!thread || thread.userId !== user._id) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getInlineItemForGrading took ${ms}ms`);
      return null;
    }
    const item = await ctx.db.get(itemId);
    if (!item || item.practiceSetId !== session.practiceSetId) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getInlineItemForGrading took ${ms}ms`);
      return null;
    }
    const result = {
      prompt: item.question,
      expectedAnswer: item.answer,
      skill: item.skills[0] ?? "allgemein",
      rubric: item.rubric ?? [],
    };
    const ms = Date.now() - start;
    if (ms > 500) console.warn(`[tutor-telemetry] getInlineItemForGrading took ${ms}ms`);
    return result;
  },
});

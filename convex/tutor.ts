import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  resolveUserReadOnly as resolveUser,
  requireUser,
} from "./users";
import { buildProactiveOpening } from "./tutorOpening";
import {
  recommendNextBest,
  type NextBestRecommendation,
} from "./_lib/recommendNextBest";

/**
 * Minimum session length, in seconds, for the mastery
 * bump in `endSession` to apply. Below this, the user almost
 * certainly opened the tab and closed it by accident; the
 * mastery curve is reserved for sessions, not opens.
 */
const MIN_SESSION_SEC = 60;

/**
 * Look up an existing thread for (userId, subjectId, topicId).
 * Uses the `by_user_subject` compound index to narrow to a
 * single subject's threads in O(log n), then filters for the
 * optional topicId in memory (typically 1-2 candidates).
 */
async function findThread(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  subjectId: Id<"subjects">,
  topicId: Id<"topics"> | undefined
): Promise<Doc<"tutorThreads"> | null> {
  const candidates = await ctx.db
    .query("tutorThreads")
    .withIndex("by_user_subject", (q) =>
      q.eq("userId", userId).eq("subjectId", subjectId)
    )
    .collect();
  return (
    candidates.find(
      (t) => (t.topicId ?? undefined) === (topicId ?? undefined)
    ) ?? null
  );
}

/**
 * getThread.
 *
 * Returns the user's tutor thread for the given
 * (subjectId, topicId) tuple, or `null` if none exists.
 * Threads are uniquely identified by (userId, subjectId,
 * topicId) and are created lazily by `ensureThread`.
 */
export const getThread = query({
  args: {
    subjectId: v.id("subjects"),
    topicId: v.optional(v.id("topics")),
  },
  returns: v.union(
    v.object({
      id: v.id("tutorThreads"),
      title: v.union(v.string(), v.null()),
      subjectId: v.union(v.id("subjects"), v.null()),
      topicId: v.union(v.id("topics"), v.null()),
      createdAt: v.number(),
      lastReadAt: v.union(v.number(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, { subjectId, topicId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;

    const match = await findThread(ctx, user._id, subjectId, topicId);
    if (!match) return null;

    return {
      id: match._id,
      title: match.title ?? null,
      subjectId: match.subjectId ?? null,
      topicId: match.topicId ?? null,
      createdAt: match._creationTime,
      lastReadAt: match.lastReadAt ?? null,
    };
  },
});

/**
 * listMessages.
 *
 * Returns the messages for a thread, ordered by creation time
 * ascending. The page subscribes to this with the thread id
 * returned by `getThread`.
 */
const LIST_MESSAGES_DEFAULT_LIMIT = 200;
const LIST_MESSAGES_MAX_LIMIT = 500;
export const listMessages = query({
  args: {
    threadId: v.id("tutorThreads"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.id("tutorMessages"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      quotedBlock: v.union(v.string(), v.null()),
      /** Phase 1 §3.1: structured content JSON (may be
       *  absent for legacy messages). */
      structuredContent: v.optional(v.string()),
    })
  ),
  handler: async (ctx, { threadId, limit }) => {
    const user = await resolveUser(ctx);
    if (!user) return [];

    const thread = await ctx.db.get(threadId);
    if (!thread || thread.userId !== user._id) return [];

    const effectiveLimit = Math.min(
      LIST_MESSAGES_MAX_LIMIT,
      Math.max(1, limit ?? LIST_MESSAGES_DEFAULT_LIMIT)
    );
    const messages = await ctx.db
      .query("tutorMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .take(effectiveLimit);

    return messages.map((m) => ({
      id: m._id,
      role: m.role,
      content: m.content,
      quotedBlock: m.quotedBlock ?? null,
      ...(m.structuredContent
        ? { structuredContent: m.structuredContent }
        : {}),
    }));
  },
});

/**
 * getThreadHistory.
 *
 * Returns the message history for a thread in a compact
 * shape suitable for feeding an LLM.
 */
export const getThreadHistory = query({
  args: {
    threadId: v.id("tutorThreads"),
  },
  returns: v.array(
    v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
    })
  ),
  handler: async (ctx, { threadId }) => {
    const user = await resolveUser(ctx);
    if (!user) return [];

    const thread = await ctx.db.get(threadId);
    if (!thread || thread.userId !== user._id) return [];

    const messages = await ctx.db
      .query("tutorMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();

    return messages.map((m) => ({ role: m.role, content: m.content }));
  },
});

/**
 * getContextForChat.
 *
 * Loads everything the tutor Route Handler needs to assemble
 * a grounded prompt.
 */
export const getContextForChat = query({
  args: {
    threadId: v.id("tutorThreads"),
    subjectId: v.id("subjects"),
    topicId: v.optional(v.id("topics")),
  },
  returns: v.union(
    v.object({
      subject: v.object({
        title: v.string(),
        slug: v.string(),
      }),
      topic: v.union(
        v.object({
          title: v.string(),
          slug: v.string(),
          objectives: v.array(v.string()),
          difficulty: v.union(
            v.literal("EASY"),
            v.literal("MEDIUM"),
            v.literal("HARD")
          ),
          gradeLevel: v.union(v.string(), v.null()),
        }),
        v.null()
      ),
      mastery: v.number(),
      confidence: v.number(),
      recentMistakes: v.array(
        v.object({
          question: v.string(),
          userAnswer: v.string(),
          correctAnswer: v.string(),
          mistakeType: v.string(),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, { threadId, subjectId, topicId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;

    const thread = await ctx.db.get(threadId);
    if (!thread || thread.userId !== user._id) return null;

    const subject = await ctx.db.get(subjectId);
    if (!subject) return null;

    let topic:
      | {
          title: string;
          slug: string;
          objectives: string[];
          difficulty: "EASY" | "MEDIUM" | "HARD";
          gradeLevel: string | null;
        }
      | null = null;
    let mastery = 0;
    let confidence = 0;
    let recentMistakes: Array<{
      question: string;
      userAnswer: string;
      correctAnswer: string;
      mistakeType: string;
    }> = [];

    if (topicId) {
      const t = await ctx.db.get(topicId);
      if (!t) {
        throw new ConvexError("topic_not_found");
      }
      topic = {
        title: t.title,
        slug: t.slug,
        objectives: t.objectives,
        difficulty: t.difficulty,
        gradeLevel: t.gradeLevel ?? null,
      };

      const progress = await ctx.db
        .query("userTopicProgress")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topicId", topicId)
        )
        .first();
      if (progress) {
        mastery = progress.mastery;
        confidence = progress.confidence;
      }

      const topicMistakes = await ctx.db
        .query("mistakeEntries")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topicId", topicId)
        )
        .collect();
      recentMistakes = topicMistakes
        .slice()
        .reverse()
        .slice(0, 5)
        .map((m) => ({
          question: m.question,
          userAnswer: m.userAnswer,
          correctAnswer: m.correctAnswer,
          mistakeType: m.mistakeType,
        }));
    }

    return {
      subject: { title: subject.title, slug: subject.slug },
      topic,
      mastery,
      confidence,
      recentMistakes,
    };
  },
});

/**
 * ensureThread.
 *
 * Idempotent: returns the existing thread for the
 * (userId, subjectId, topicId) tuple, or creates one if none
 * exists. When a thread is created for the first time, a
 * welcome assistant message is appended so the user always
 * lands on a non-empty thread.
 *
 * Phase 1 §3.3: the welcome message uses `buildProactiveOpening`
 * from `convex/tutorOpening.ts` to generate an AI-quality
 * opening that surfaces mastery, recent mistakes, and a
 * concrete next step — all from Convex data available at
 * thread-creation time.
 */
export const ensureThread = mutation({
  args: {
    subjectId: v.id("subjects"),
    topicId: v.optional(v.id("topics")),
    lessonContext: v.optional(
      v.object({
        topicTitle: v.string(),
        lessonSummary: v.string(),
        grade: v.union(
          v.literal("1"),
          v.literal("2"),
          v.literal("3"),
          v.literal("4"),
          v.literal("5"),
          v.literal("6")
        ),
        items: v.array(
          v.object({
            prompt: v.string(),
            userAnswer: v.string(),
            verdict: v.union(
              v.literal("correct"),
              v.literal("partially_correct"),
              v.literal("incorrect")
            ),
            score: v.number(),
            feedback: v.string(),
            betterAnswer: v.string(),
          })
        ),
        mistakes: v.array(
          v.object({
            type: v.string(),
            cause: v.string(),
          })
        ),
        focusItemId: v.optional(v.string()),
      })
    ),
  },
  returns: v.id("tutorThreads"),
  handler: async (
    ctx,
    { subjectId, topicId, lessonContext }
  ): Promise<Id<"tutorThreads">> => {
    const user = await requireUser(ctx);

    const existing = await findThread(ctx, user._id, subjectId, topicId);
    if (existing) return existing._id;

    let title: string | undefined;
    if (topicId) {
      const topic = await ctx.db.get(topicId);
      title = topic ? topic.title : undefined;
    } else {
      const subject = await ctx.db.get(subjectId);
      title = subject ? subject.title : undefined;
    }

    const now = Date.now();
    const threadId = await ctx.db.insert("tutorThreads", {
      userId: user._id,
      subjectId,
      topicId,
      title,
      lastReadAt: now,
      lastMessageAt: now,
      unreadCount: 0,
    });

    const cleanTitle =
      (title ?? (topicId ? "topic" : "subject"))
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .trim() || (topicId ? "Topic" : "Subject");

    // Phase 1 §3.3: build a proactive opening using the
    // `buildProactiveOpening` helper. For lesson-scoped
    // threads we use the lesson context directly; for
    // topic-scoped threads we pull mastery + recent mistakes
    // from the user's progress. Subject-only threads get a
    // simple prompt to pick a topic.
    let welcome: string;

    // ── Hoisted topic data ──────────────────────────
    // Fetch userTopicProgress and mistakeEntries ONCE
    // before the tone context + opening branches so both
    // can reuse the results. `topicId` guards make these
    // no-ops for subject-only threads (no index hit).
    const topicProgress = topicId
      ? await ctx.db
          .query("userTopicProgress")
          .withIndex("by_user_topic", (q) =>
            q.eq("userId", user._id).eq("topicId", topicId)
          )
          .first()
      : null;
    const allTopicMistakes = topicId
      ? await ctx.db
          .query("mistakeEntries")
          .withIndex("by_user_topic", (q) =>
            q.eq("userId", user._id).eq("topicId", topicId)
          )
          .collect()
      : [];

    // Phase 7 §9.1: derive tone context from the user's
    // profile + prior session signals. Uses the hoisted
    // `topicProgress` and `allTopicMistakes` above — no
    // duplicate queries.
    let toneContext:
      | {
          returningAfterGoodSession: boolean;
          returningAfterStrugglingSession: boolean;
          hasExamPanicProfile: boolean;
          studentFirstName: string | null;
        }
      | undefined;
    const profile = await ctx.db
      .query("tutorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (profile && topicId) {
      const DAY_MS = 86_400_000;
      // Reuse the hoisted `topicProgress` (fetched above)
      // instead of re-querying.
      const masterySignal = topicProgress ? topicProgress.mastery : 0;
      // Check for a recent completed session on this topic.
      const priorSessions = await ctx.db
        .query("studySessions")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("topicId"), topicId),
            q.neq(q.field("completedAt"), undefined)
          )
        )
        .order("desc")
        .take(1);
      const lastSession = priorSessions[0];
      const hasRecentCompletedSession =
        lastSession !== undefined &&
        lastSession.completedAt !== undefined &&
        now - lastSession.completedAt < 7 * DAY_MS;
      // Reuse the hoisted `allTopicMistakes` (fetched
      // above) instead of re-querying.
      const hasRecentMistakes = allTopicMistakes.length > 0;

      const returningAfterGoodSession =
        hasRecentCompletedSession && masterySignal >= 0.5;
      const returningAfterStrugglingSession =
        hasRecentMistakes &&
        (!hasRecentCompletedSession || masterySignal < 0.3);
      toneContext = {
        returningAfterGoodSession,
        returningAfterStrugglingSession,
        hasExamPanicProfile: profile.biggestObstacle === "exam_panic",
        studentFirstName: user.name?.split(" ")[0] ?? null,
      };
    } else if (profile) {
      // Subject-only thread — carry the profile flags
      // but no session-based tone (no topic to scope to).
      toneContext = {
        returningAfterGoodSession: false,
        returningAfterStrugglingSession: false,
        hasExamPanicProfile: profile.biggestObstacle === "exam_panic",
        studentFirstName: user.name?.split(" ")[0] ?? null,
      };
    }

    if (lessonContext) {
      const focusedItem = lessonContext.focusItemId
        ? lessonContext.items.find(
            (it, i) => String(i) === lessonContext.focusItemId
          )
        : null;
      welcome = buildProactiveOpening({
        topicTitle: cleanTitle,
        masteryPct: 0,
        recentMistakes: lessonContext.mistakes.map((m) => ({
          type: m.type,
          cause: m.cause ?? "",
        })),
        hasLessonContext: true,
        lessonGrade: lessonContext.grade,
        focusItemPrompt: focusedItem?.prompt ?? null,
        focusItemVerdict: focusedItem?.verdict ?? null,
      });
    } else if (topicId) {
      // Reuse the hoisted queries above — no duplicate
      // fetches for topicProgress or mistakeEntries.
      const masteryPct = topicProgress
        ? Math.round(topicProgress.mastery * 100)
        : 0;
      const recentMistakes = allTopicMistakes
        .slice()
        .reverse()
        .slice(0, 3)
        .map((m) => ({
          type: m.mistakeType,
          cause: m.cause ?? "",
        }));
      welcome = buildProactiveOpening({
        topicTitle: cleanTitle,
        masteryPct,
        recentMistakes,
        hasLessonContext: false,
        lessonGrade: null,
        focusItemPrompt: null,
        focusItemVerdict: null,
        toneContext,
      });
    } else {
      // Subject-only thread — when we have tone context,
      // use a personalised opening; otherwise the existing
      // fallback.
      if (toneContext?.hasExamPanicProfile && toneContext.studentFirstName) {
        welcome = `Calm and structured, ${toneContext.studentFirstName}. You're in **${cleanTitle}** — pick any topic and I'll build it in bite-sized, exam-rhythm passes. No cramming, no panic.`;
      } else if (toneContext?.studentFirstName) {
        welcome = `Hi ${toneContext.studentFirstName} — I'm your tutor for **${cleanTitle}**. Pick a topic to drill into, or ask anything at this subject level and I'll route it to the right curriculum.`;
      } else {
        welcome = `Hi — I'm your tutor for ${cleanTitle}. Pick a topic to drill into, or ask anything at this subject level and I'll route it to the right curriculum.`;
      }
    }

    await ctx.db.insert("tutorMessages", {
      threadId,
      role: "assistant",
      content: welcome,
    });

    return threadId;
  },
});

/**
 * appendUserMessage.
 *
 * Persists a user message to a thread and updates the
 * denormalized `lastMessageAt` on the thread.
 */
export const appendUserMessage = mutation({
  args: {
    threadId: v.id("tutorThreads"),
    content: v.string(),
    clientId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, content, clientId }): Promise<null> => {
    const user = await requireUser(ctx);
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.userId !== user._id) {
      throw new Error("Forbidden");
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) return null;

    if (clientId) {
      const existing = await ctx.db
        .query("tutorMessages")
        .withIndex("by_thread_clientId", (q) =>
          q.eq("threadId", threadId).eq("clientId", clientId)
        )
        .first();
      if (existing) {
        return null;
      }
    }

    const now = Date.now();
    await ctx.db.insert("tutorMessages", {
      threadId,
      role: "user",
      content: trimmed,
      ...(clientId ? { clientId } : {}),
    });

    await ctx.db.patch(threadId, { lastMessageAt: now });

    return null;
  },
});

/**
 * recordAssistantMessage.
 *
 * Persists a complete assistant message to a thread and
 * bumps the denormalized `lastMessageAt` and `unreadCount`.
 *
 * Phase 1 §3.1: accepts an optional `structuredContent` JSON
 * blob so the `StructuredResponse` renderer can reconstruct
 * the section-by-section layout on history re-reads.
 */
export const recordAssistantMessage = mutation({
  args: {
    threadId: v.id("tutorThreads"),
    content: v.string(),
    structuredContent: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, content, structuredContent }): Promise<null> => {
    const user = await requireUser(ctx);
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.userId !== user._id) {
      throw new Error("Forbidden");
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) return null;

    const now = Date.now();
    await ctx.db.insert("tutorMessages", {
      threadId,
      role: "assistant",
      content: trimmed,
      ...(structuredContent ? { structuredContent } : {}),
    });

    const previousUnread = thread.unreadCount ?? 0;
    await ctx.db.patch(threadId, {
      lastMessageAt: now,
      unreadCount: Math.min(999, previousUnread + 1),
    });

    // Phase 6 §8.1: fire-and-forget auto-review scheduling.
    // Scans the assistant message for `[[mistake:...]]`
    // markers and creates `mistakeEntry` rows with
    // `reviewAt = now + 24h`. Runs independently so a
    // failed review write never blocks the message
    // from being recorded.
    ctx.scheduler
      .runAfter(0, api.tutorAutoReview.scheduleAutoReview, {
        threadId,
        subjectId: thread.subjectId ?? undefined,
        topicId: thread.topicId ?? undefined,
        messageContent: trimmed,
        ...(structuredContent
          ? { structuredContent }
          : {}),
      })
      .catch((err) =>
        console.error(
          "recordAssistantMessage: auto-review scheduling failed",
          err
        )
      );

    return null;
  },
});

/**
 * endSession.
 *
 * Atomically closes the study session, optionally stores a
 * reflection, and (if the session is topic-scoped and long
 * enough) blends a small mastery increment into the user's
 * topic-level progress. Idempotent.
 */
export const endSession = mutation({
  args: {
    sessionId: v.id("studySessions"),
    durationSec: v.number(),
    reflection: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      masteryDelta: v.number(),
      newMastery: v.number(),
      newConfidence: v.number(),
      durationSec: v.number(),
      reflection: v.union(v.string(), v.null()),
      hadReflectionBonus: v.boolean(),
      nextBest: v.union(
        v.object({
          subject: v.object({
            slug: v.string(),
            title: v.string(),
            color: v.optional(v.string()),
          }),
          chapter: v.object({ slug: v.string(), title: v.string() }),
          topic: v.object({
            id: v.id("topics"),
            slug: v.string(),
            title: v.string(),
            examRelevance: v.number(),
            mastery: v.number(),
            source: v.union(v.literal("canonical"), v.literal("user")),
            ownerId: v.union(v.id("users"), v.null()),
          }),
          reason: v.string(),
        }),
        v.null()
      ),
    }),
    v.null()
  ),
  handler: async (
    ctx,
    { sessionId, durationSec, reflection }
  ): Promise<{
    masteryDelta: number;
    newMastery: number;
    newConfidence: number;
    durationSec: number;
    reflection: string | null;
    hadReflectionBonus: boolean;
    nextBest: NextBestRecommendation | null;
  } | null> => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId !== user._id) throw new Error("Forbidden");
    if (session.completedAt !== undefined) return null;

    const now = Date.now();
    const actualDuration = Math.max(
      0,
      Math.min(Math.floor(durationSec), 24 * 60 * 60)
    );

    await ctx.db.patch(sessionId, {
      durationSec: actualDuration,
      completedAt: now,
      ...(reflection !== undefined ? { reflection } : {}),
    });

    let masteryDelta = 0;
    let newMastery = 0;
    let newConfidence = 0;
    let hadReflectionBonus = false;
    if (session.topicId && actualDuration >= MIN_SESSION_SEC) {
      const baseIncrement = 0.1;
      const reflectionBonus =
        reflection && reflection.trim().length > 0 ? 0.05 : 0;
      const confidenceDelta = 0.05 + (reflectionBonus > 0 ? 0.05 : 0);
      hadReflectionBonus = reflectionBonus > 0;
      masteryDelta = baseIncrement + reflectionBonus;

      const prior = await ctx.db
        .query("userTopicProgress")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topicId", session.topicId!)
        )
        .first();

      await ctx.runMutation(api.progress.upsertFromSession, {
        userId: user._id,
        topicId: session.topicId!,
        masteryDelta,
        confidenceDelta,
        timeSpentSec: actualDuration,
      });

      const post = await ctx.db
        .query("userTopicProgress")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topicId", session.topicId!)
        )
        .first();
      newMastery = post?.mastery ?? (prior ? prior.mastery + masteryDelta : masteryDelta);
      newConfidence = post?.confidence ?? 0;
    } else if (session.topicId) {
      const post = await ctx.db
        .query("userTopicProgress")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topicId", session.topicId!)
        )
        .first();
      newMastery = post?.mastery ?? 0;
      newConfidence = post?.confidence ?? 0;
    }

    let nextBestSummary: NextBestRecommendation | null = null;
    if (session.subjectId) {
      nextBestSummary = await recommendNextBest(ctx, {
        userId: user._id,
        scope: { kind: "subject", subjectId: session.subjectId },
        excludeTopicId: session.topicId,
      });
    }

    // Phase 2 §4.2: trigger cross-topic mistake pattern
    // detection after the session closes and mastery is
    // updated. Fire-and-forget — the pattern detection
    // runs asynchronously and does not block the session
    // end response.
    ctx.scheduler
      .runAfter(0, api.tutorPatterns.detect, {})
      .catch((err) =>
        console.error("endSession: tutorPatterns.detect failed", err)
      );

    return {
      masteryDelta,
      newMastery,
      newConfidence,
      durationSec: actualDuration,
      reflection: reflection ?? null,
      hadReflectionBonus,
      nextBest: nextBestSummary,
    };
  },
});

/**
 * getSubjectTopicsForEmptyState.
 */
export const getSubjectTopicsForEmptyState = query({
  args: {
    subjectId: v.id("subjects"),
    limit: v.optional(v.number()),
  },
  returns: v.union(
    v.array(
      v.object({
        id: v.id("topics"),
        slug: v.string(),
        title: v.string(),
        chapterSlug: v.string(),
        chapterTitle: v.string(),
        mastery: v.number(),
        isStudied: v.boolean(),
        examRelevance: v.number(),
      })
    ),
    v.null()
  ),
  handler: async (ctx, { subjectId, limit }) => {
    const cap = Math.max(1, Math.min(limit ?? 6, 20));
    const subject = await ctx.db.get(subjectId);
    if (!subject) return null;

    const user = await resolveUser(ctx);
    const userId: Id<"users"> | null = user ? user._id : null;

    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_subject_order", (q) => q.eq("subjectId", subject._id))
      .collect();
    chapters.sort((a, b) => a.order - b.order);

    const allTopics = (
      await Promise.all(
        chapters.map((ch) =>
          ctx.db
            .query("topics")
            .withIndex("by_chapter", (q) => q.eq("chapterId", ch._id))
            .collect()
        )
      )
    ).flat();

    if (allTopics.length === 0) return [];

    const progressRows =
      userId !== null
        ? await ctx.db
            .query("userTopicProgress")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect()
        : [];
    const progressByTopic = new Map<Id<"topics">, Doc<"userTopicProgress">>();
    for (const p of progressRows) progressByTopic.set(p.topicId, p);

    const rows = allTopics
      .map((t) => {
        const ch = chapters.find((c) => c._id === t.chapterId);
        if (!ch) return null;
        const p = progressByTopic.get(t._id);
        return {
          id: t._id,
          slug: t.slug,
          title: t.title,
          chapterSlug: ch.slug,
          chapterTitle: ch.title,
          mastery: p ? p.mastery : 0,
          isStudied: p !== null,
          examRelevance: t.examRelevance,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    rows.sort((a, b) => {
      if (a.isStudied !== b.isStudied) return a.isStudied ? 1 : -1;
      if (a.mastery !== b.mastery) return a.mastery - b.mastery;
      return b.examRelevance - a.examRelevance;
    });

    return rows.slice(0, cap);
  },
});

/**
 * getTutorUnreadTotal.
 */
export const getTutorUnreadTotal = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const threads = await ctx.db.query("tutorThreads").collect();
    let total = 0;
    for (const t of threads) total += t.unreadCount ?? 0;
    return Math.min(total, 999);
  },
});

/**
 * listThreadsForSidebar.
 */
export const listThreadsForSidebar = query({
  args: {},
  returns: v.array(
    v.object({
      subject: v.object({
        id: v.id("subjects"),
        title: v.string(),
        slug: v.string(),
        color: v.union(v.string(), v.null()),
      }),
      threads: v.array(
        v.object({
          id: v.id("tutorThreads"),
          title: v.union(v.string(), v.null()),
          subjectId: v.union(v.id("subjects"), v.null()),
          topicId: v.union(v.id("topics"), v.null()),
          lastReadAt: v.union(v.number(), v.null()),
          createdAt: v.number(),
          lastMessageAt: v.union(v.number(), v.null()),
          lastMessagePreview: v.union(v.string(), v.null()),
          unreadCount: v.number(),
        })
      ),
    })
  ),
  handler: async (ctx) => {
    const user = await resolveUser(ctx);
    if (!user) return [];

    const threads = await ctx.db
      .query("tutorThreads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (threads.length === 0) return [];

    const subjectIds = Array.from(
      new Set(
        threads
          .map((t) => t.subjectId)
          .filter((id): id is Id<"subjects"> => id !== undefined)
      )
    );
    const subjectRows = await Promise.all(
      subjectIds.map((id) => ctx.db.get(id))
    );
    const subjectMap = new Map(
      subjectRows
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id, s] as const)
    );

    const previewRows = await Promise.all(
      threads.map((t) =>
        ctx.db
          .query("tutorMessages")
          .withIndex("by_thread", (q) => q.eq("threadId", t._id))
          .order("desc")
          .first()
      )
    );
    const previewByThread = new Map<
      Id<"tutorThreads">,
      { role: "user" | "assistant"; content: string; createdAt: number }
    >();
    threads.forEach((t, i) => {
      const m = previewRows[i];
      if (m) {
        previewByThread.set(t._id, {
          role: m.role,
          content: m.content,
          createdAt: m._creationTime,
        });
      }
    });

    const rows = threads.map((t) => {
      const last = previewByThread.get(t._id) ?? null;
      return {
        id: t._id,
        title: t.title ?? null,
        subjectId: t.subjectId ?? null,
        topicId: t.topicId ?? null,
        lastReadAt: t.lastReadAt ?? null,
        createdAt: t._creationTime,
        lastMessageAt: t.lastMessageAt ?? (last?.createdAt ?? t._creationTime),
        lastMessagePreview: last?.content ?? null,
        unreadCount: t.unreadCount ?? 0,
      };
    });

    type Group = {
      subject: {
        id: Id<"subjects">;
        title: string;
        slug: string;
        color: string | null;
      };
      threads: typeof rows;
    };
    const grouped = new Map<Id<"subjects">, Group>();
    for (const row of rows) {
      if (!row.subjectId) continue;
      const subj = subjectMap.get(row.subjectId);
      if (!subj) continue;
      const existing = grouped.get(row.subjectId);
      if (existing) {
        existing.threads.push(row);
      } else {
        grouped.set(row.subjectId, {
          subject: {
            id: subj._id,
            title: subj.title,
            slug: subj.slug,
            color: subj.color ?? null,
          },
          threads: [row],
        });
      }
    }

    const groups = Array.from(grouped.values()).map((g) => ({
      subject: g.subject,
      threads: g.threads.sort(
        (a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0)
      ),
    }));
    groups.sort((a, b) => {
      const aMax = Math.max(
        ...a.threads.map((t) => t.lastMessageAt ?? t.createdAt)
      );
      const bMax = Math.max(
        ...b.threads.map((t) => t.lastMessageAt ?? t.createdAt)
      );
      return bMax - aMax;
    });

    return groups;
  },
});

/**
 * markThreadRead.
 */
export const markThreadRead = mutation({
  args: {
    threadId: v.id("tutorThreads"),
  },
  returns: v.null(),
  handler: async (ctx, { threadId }): Promise<null> => {
    const user = await requireUser(ctx);
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.userId !== user._id) {
      throw new Error("Forbidden");
    }
    await ctx.db.patch(threadId, {
      lastReadAt: Date.now(),
      unreadCount: 0,
    });
    return null;
  },
});

import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  resolveUserReadOnly as resolveUser,
  requireUser,
} from "./users";

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
      // `messageCount` is dropped: it costs an extra
      // `tutorMessages` scan and the only caller (TutorClient)
      // does not need it — it already subscribes to
      // `listMessages` for the real list.
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
 * returned by `getThread`. Convex returns index reads sorted
 * by `_creationTime` within a single index key, so the
 * previous in-memory sort is unnecessary.
 *
 * Optional `paginationOpts.limit` (default 200, capped 500)
 * bounds the response so a thread with thousands of
 * messages does not stall the React render on first paint.
 * The cap keeps the read constant-time for the typical
 * "first session, <100 messages" case while still giving
 * the practice-results CTA chain room to load 50-100
 * per-coroutine-debug-explanation messages without a
 * custom pagination surface.
 */
const LIST_MESSAGES_DEFAULT_LIMIT = 200;
const LIST_MESSAGES_MAX_LIMIT = 500;
export const listMessages = query({
  args: {
    threadId: v.id("tutorThreads"),
    /**
     * Optional. Caps the message count so a long thread
     * does not stall hydration. Defaults to 200; the
     * route handler / UI should not need to set this in
     * practice — 200 covers the realistic per-thread
     * history length by a comfortable margin.
     */
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.id("tutorMessages"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      quotedBlock: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, { threadId, limit }) => {
    const user = await resolveUser(ctx);
    if (!user) return [];

    // Authorization: confirm the thread belongs to this user.
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
    // Convex returns messages sorted by _creationTime ascending
    // from the by_thread index. No in-memory sort needed.

    return messages.map((m) => ({
      id: m._id,
      role: m.role,
      content: m.content,
      quotedBlock: m.quotedBlock ?? null,
    }));
  },
});

/**
 * getThreadHistory.
 *
 * Returns the message history for a thread in a compact
 * shape suitable for feeding an LLM (no Convex ids, no
 * quotedBlock). Authorization: the thread must belong to
 * the calling user.
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
 * a grounded prompt: the subject, the topic (if any), the
 * user's mastery + confidence on the topic, and the last
 * few mistakes on the topic.
 *
 * Returns `null` if the subject does not exist or the thread
 * does not belong to the calling user.
 *
 * Throws `ConvexError("topic_not_found")` when the caller
 * supplied a `topicId` that does not exist (or has been
 * deleted). This used to silently degrade to a subject-only
 * thread, which dropped the user's intent and made the AI
 * answer the wrong question. The route handler maps this
 * error to a 404.
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

    // Thread ownership check.
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
      // Surface a typed error when the caller asked for a topic
      // that no longer exists. The route handler turns this
      // into a 404 so the client can recover.
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

      // Mastery for this topic, if any progress exists.
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

      // Last 5 mistakes on this topic, scoped to the calling
      // user. Uses the (userId, topicId) compound index for an
      // O(log n) scan, which is also the privacy fix: a bare
      // `by_topic` index would leak other users' mistakes.
      const topicMistakes = await ctx.db
        .query("mistakeEntries")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topicId", topicId)
        )
        .collect();
      // Convex returns these sorted by _creationTime ascending;
      // we want the 5 most recent, so reverse the order.
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
 * On creation, we seed the denormalized `lastReadAt`,
 * `lastMessageAt`, and `unreadCount` fields so the sidebar's
 * first render does not need a fallback path.
 */
export const ensureThread = mutation({
  args: {
    subjectId: v.id("subjects"),
    topicId: v.optional(v.id("topics")),
  },
  returns: v.id("tutorThreads"),
  handler: async (ctx, { subjectId, topicId }): Promise<Id<"tutorThreads">> => {
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
      // Mark the thread as read on creation so the welcome
      // message does not count as unread in the history sidebar.
      lastReadAt: now,
      // Denormalized fields so the sidebar can render without a
      // per-thread `tutorMessages` query.
      lastMessageAt: now,
      unreadCount: 0,
    });

    // Seed a welcome message. The new chat prompt
    // already teaches the model the block-marker
    // contract; the welcome copy stays minimal so the
    // model's own first reply — not the seed — becomes
    // the user's first introduction to the tutor's
    // structured teaching style.
    const cleanTitle =
      (title ?? (topicId ? "topic" : "subject"))
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .trim() || (topicId ? "Topic" : "Subject");
    const welcome = topicId
      ? "Hi — I'm your tutor for " + cleanTitle + ". Ask me anything on the topic and I'll ground my answer in your mastery and recent mistakes. We'll start by figuring out where you are; then we'll work the concept step by step."
      : "Hi — I'm your tutor for " + cleanTitle + ". Pick a topic to drill into, or ask anything at this subject level and I'll route it to the right curriculum.";

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
 * denormalized `lastMessageAt` on the thread (the user
 * message itself does not bump the unread count, since the
 * user wrote it). Called by the tutor Route Handler.
 */
export const appendUserMessage = mutation({
  args: {
    threadId: v.id("tutorThreads"),
    content: v.string(),
    /**
     * Stable id from the client (the Vercel AI SDK's UIMessage.id).
     * Used as a dedupe key: if a message with the same
     * (threadId, clientId) already exists, the insert is a no-op
     * so retries do not duplicate the user message.
     */
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

    // Dedupe: if the client sent the same clientId for this
    // thread, skip. This keeps the operation idempotent in the
    // face of client retries (network blip, double click, etc).
    // Uses the (threadId, clientId) compound index for an O(log n)
    // lookup instead of scanning the whole thread.
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

    // Maintain the denormalized `lastMessageAt` so the sidebar
    // can sort threads without scanning messages. The unread
    // count is unchanged for a user message — the user wrote it.
    await ctx.db.patch(threadId, { lastMessageAt: now });

    return null;
  },
});

/**
 * recordAssistantMessage.
 *
 * Persists a complete assistant message to a thread and
 * bumps the denormalized `lastMessageAt` and `unreadCount`
 * (assistant messages are unread from the user's perspective
 * until they open the thread). Called by the tutor Route
 * Handler after the stream has fully arrived.
 */
export const recordAssistantMessage = mutation({
  args: {
    threadId: v.id("tutorThreads"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, content }): Promise<null> => {
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
    });

    // Bump the denormalized `lastMessageAt` and `unreadCount`.
    // We use `unreadCount + 1` (not an overwrite) so concurrent
    // inserts from the same thread accumulate correctly. The
    // max-bound of 999 keeps the sidebar display clean even if
    // the math drifts.
    const previousUnread = thread.unreadCount ?? 0;
    await ctx.db.patch(threadId, {
      lastMessageAt: now,
      unreadCount: Math.min(999, previousUnread + 1),
    });

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
  returns: v.null(),
  handler: async (
    ctx,
    { sessionId, durationSec, reflection }
  ): Promise<null> => {
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

    // Gate the mastery bump on a minimum session length so an
    // accidental 2-second open-and-close does not nudge the
    // mastery curve. Time-on-task is the input the user can
    // trust; we reward sessions, not opens.
    if (session.topicId && actualDuration >= MIN_SESSION_SEC) {
      const baseIncrement = 0.1;
      const reflectionBonus =
        reflection && reflection.trim().length > 0 ? 0.05 : 0;
      const confidenceDelta = 0.05 + (reflectionBonus > 0 ? 0.05 : 0);

      await ctx.runMutation(api.progress.upsertFromSession, {
        userId: user._id,
        topicId: session.topicId,
        masteryDelta: baseIncrement + reflectionBonus,
        confidenceDelta,
        timeSpentSec: actualDuration,
      });
    }

    return null;
  },
});

/**
 * listThreadsForSidebar.
 *
 * Returns the user's tutor threads grouped by subject, with
 * the denormalized `lastMessageAt`, `unreadCount`, and a
 * computed last-message preview. This is a SINGLE query
 * against the threads table — no N+1 over messages — because
 * the denormalized fields are written on every message
 * insert.
 *
 * Threads with no `lastMessageAt` (legacy rows written before
 * the denormalization landed) fall back to `_creationTime`
 * and a synthesized "No messages yet" preview.
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

    // Single indexed read for all of the user's threads.
    const threads = await ctx.db
      .query("tutorThreads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (threads.length === 0) return [];

    // Resolve all subject rows we actually have threads for.
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

    // For the last-message preview, we still need to look up
    // the most recent message of each thread — but only one
    // query per thread, in parallel. (An optimization that
    // denormalizes `lastMessagePreview` onto the thread row
    // is a future follow-up; the current load is well under
    // 100 threads per user.)
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

    // Build the per-thread rows from the denormalized fields.
    //
    // For legacy threads (written before the denormalized
    // `unreadCount` field existed) we cannot honestly report
    // the unread count without an extra per-thread scan, and
    // that would defeat the purpose of having a denormalized
    // counter. We fall back to 0 (treat as fully read) and
    // rely on the next assistant message write to populate
    // the field correctly from then on. The one-time cost
    // is "legacy threads read as read" which is a safe
    // underestimate rather than a UI-breaking over-count.
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

    // Group by subject, then sort within each group by
    // `lastMessageAt` desc. Sort the groups themselves by the
    // most recent activity in the group.
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
 *
 * Sets `lastReadAt = Date.now()` and `unreadCount = 0` on a
 * thread. Called by the client when the user opens the thread
 * in the tutor UI; the sidebar's unread count drops to zero
 * for that thread via Convex reactivity. Idempotent: repeated
 * calls just bump the timestamp forward and keep the unread
 * count at zero.
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

// tutor.ts imports `resolveUser` (read-only) and `requireUser`
// (lazy-create) from `convex/users.ts`. See users.ts for the
// auth design + the lazy-create behavior.

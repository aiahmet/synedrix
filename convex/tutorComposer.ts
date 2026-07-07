import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, resolveUserReadOnly as resolveUser } from "./users";

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

/**
 * getThreadById.
 *
 * Returns minimal thread info for URL routing.
 * Only returns the thread if it belongs to the current user.
 */
export const getThreadById = query({
  args: { threadId: v.id("tutorThreads") },
  returns: v.union(
    v.object({
      subjectId: v.union(v.id("subjects"), v.null()),
      topicId: v.union(v.id("topics"), v.null()),
      subjectSlug: v.union(v.string(), v.null()),
      topicSlug: v.union(v.string(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, { threadId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.userId !== user._id) return null;

    let subjectSlug: string | null = null;
    let topicSlug: string | null = null;

    if (thread.subjectId) {
      const subject = await ctx.db.get(thread.subjectId);
      subjectSlug = subject?.slug ?? null;
    }
    if (thread.topicId) {
      const topic = await ctx.db.get(thread.topicId);
      topicSlug = topic?.slug ?? null;
    }

    return {
      subjectId: thread.subjectId ?? null,
      topicId: thread.topicId ?? null,
      subjectSlug,
      topicSlug,
    };
  },
});

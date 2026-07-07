import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  resolveUserReadOnly as resolveUser,
  requireUser,
} from "./users";

export const start = mutation({
  args: {
    subjectId: v.id("subjects"),
    topicId: v.optional(v.id("topics")),
    intention: v.optional(v.string()),
  },
  returns: v.id("studySessions"),
  handler: async (
    ctx,
    { subjectId, topicId, intention }
  ): Promise<Id<"studySessions">> => {
    const user = await requireUser(ctx);

    const subject = await ctx.db.get(subjectId);
    if (!subject) throw new Error("Subject not found");

    if (topicId) {
      const topic = await ctx.db.get(topicId);
      if (!topic) throw new Error("Topic not found");
      const chapter = await ctx.db.get(topic.chapterId);
      if (!chapter) throw new Error("Chapter not found");
      if (chapter.subjectId !== subjectId) {
        throw new Error("Topic does not belong to subject");
      }
    }

    return await ctx.db.insert("studySessions", {
      userId: user._id,
      subjectId,
      ...(topicId ? { topicId } : {}),
      intention,
      durationSec: 0,
    });
  },
});

export const complete = mutation({
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

    const actualDuration = Math.max(
      0,
      Math.min(Math.floor(durationSec), 24 * 60 * 60)
    );
    await ctx.db.patch(sessionId, {
      durationSec: actualDuration,
      completedAt: Date.now(),
      ...(reflection !== undefined ? { reflection } : {}),
    });
    return null;
  },
});

export const getByIdForCurrentUser = query({
  args: {
    sessionId: v.id("studySessions"),
  },
  returns: v.union(
    v.object({
      id: v.id("studySessions"),
      userId: v.id("users"),
      subjectId: v.union(v.id("subjects"), v.null()),
      topicId: v.union(v.id("topics"), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, { sessionId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== user._id) return null;
    return {
      id: session._id,
      userId: session.userId,
      subjectId: session.subjectId ?? null,
      topicId: session.topicId ?? null,
    };
  },
});

export const getActiveForCurrentUser = query({
  args: {},
  returns: v.object({
    session: v.union(
      v.object({
        id: v.id("studySessions"),
        subjectId: v.union(v.id("subjects"), v.null()),
        topicId: v.union(v.id("topics"), v.null()),
        intention: v.union(v.string(), v.null()),
        href: v.string(),
      }),
      v.null()
    ),
    practice: v.union(
      v.object({
        id: v.id("topicLessonPractice"),
        topicId: v.id("topics"),
        href: v.string(),
        answeredCount: v.number(),
        itemCount: v.number(),
      }),
      v.null()
    ),
  }),
  handler: async (ctx) => {
    const user = await resolveUser(ctx);
    if (!user) return { session: null, practice: null };

    const recentSessions = await ctx.db
      .query("studySessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(20);
    const inProgressSessions = recentSessions
      .filter((s) => s.completedAt === undefined)
      .sort((a, b) => b._creationTime - a._creationTime);
    const topSession = inProgressSessions[0] ?? null;

    let sessionOut: {
      id: Id<"studySessions">;
      subjectId: Id<"subjects"> | null;
      topicId: Id<"topics"> | null;
      intention: string | null;
      href: string;
    } | null = null;
    if (topSession) {
      const [subject, topic] = await Promise.all([
        topSession.subjectId ? ctx.db.get(topSession.subjectId) : Promise.resolve(null),
        topSession.topicId ? ctx.db.get(topSession.topicId) : Promise.resolve(null),
      ]);
      const params = new URLSearchParams();
      if (subject) params.set("subject", subject.slug);
      if (topic) params.set("topic", topic.slug);
      if (topSession._id) {
        params.set("session", String(topSession._id));
      }
      sessionOut = {
        id: topSession._id,
        subjectId: topSession.subjectId ?? null,
        topicId: topSession.topicId ?? null,
        intention: topSession.intention ?? null,
        href: `/tutor?${params.toString()}`,
      };
    }

    const recentRuns = await ctx.db
      .query("topicLessonPractice")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(20);
    const inProgressRuns = recentRuns
      .filter((r) => r.status === "in_progress")
      .sort((a, b) => b.startedAt - a.startedAt);
    const topRun = inProgressRuns[0] ?? null;

    let practiceOut: {
      id: Id<"topicLessonPractice">;
      topicId: Id<"topics">;
      href: string;
      answeredCount: number;
      itemCount: number;
    } | null = null;
    if (topRun) {
      const topic = await ctx.db.get(topRun.topicId);
      if (topic) {
        const chapter = await ctx.db.get(topic.chapterId);
        const subject = chapter ? await ctx.db.get(chapter.subjectId) : null;
        if (chapter && subject) {
          const href =
            topic.source === "user"
              ? `/my-topics/${topic.slug}/practice`
              : `/subjects/${subject.slug}/${chapter.slug}/${topic.slug}`;
          practiceOut = {
            id: topRun._id,
            topicId: topic._id,
            href,
            answeredCount: topRun.answeredCount,
            itemCount: topRun.itemCount,
          };
        }
      }
    }

    return { session: sessionOut, practice: practiceOut };
  },
});

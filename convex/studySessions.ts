import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  resolveUserReadOnly as resolveUser,
  requireUser,
} from "./users";

/**
 * start.
 *
 * Creates a new study session row for the current user on the
 * given subject. Optionally scoped to a specific topic. The
 * session is created in an "open" state (no `completedAt`, no
 * reflection, no duration yet) and is later closed by `complete`.
 *
 * Used by the "Start a study session" CTA on /subjects/[slug]
 * and the "Start topic" CTA on /subjects/[slug]/[chapterSlug].
 * The session is recorded against the user even if the user is
 * not yet formally enrolled in the subject, so the cockpit can
 * still surface the activity. The SubjectHeader CTA on
 * /subjects/[slug] is gated by `enrolled`, but the TopicRow
 * "Start topic" CTA on /subjects/[slug]/[chapterSlug] is not
 * — the page is reachable for any curriculum topic, so we
 * accept sessions from unenrolled users there.
 *
 * Returns the new session id.
 */
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

    // Validate the subject actually exists so we never write a
    // dangling foreign key.
    const subject = await ctx.db.get(subjectId);
    if (!subject) throw new Error("Subject not found");

    // If a topicId is provided, also validate it exists and that
    // it belongs to a chapter in the same subject. We do the
    // cross-check so a malformed caller cannot start a session
    // that points at a topic from a different subject.
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

/**
 * complete.
 *
 * Closes an open study session. Sets `completedAt` to now,
 * records the duration in seconds, and optionally stores the
 * user's reflection. Intended to be called when the user ends
 * a session from the tutor or review page.
 *
 * Idempotent: completing an already-completed session is a no-op
 * (we do not overwrite a previous reflection with empty data).
 */
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

    // 24h cap on a single session — anything longer is almost
    // certainly a tab the user forgot to close. Matches the cap
    // in tutor.endSession so the two entry points behave
    // consistently.
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

/**
 * getByIdForCurrentUser.
 *
 * Returns a session if and only if it belongs to the current
 * user; otherwise `null`. Used by the /tutor page to validate
 * the `?session=...` query param so the UI does not render the
 * "Active session" chrome for a session the user does not own.
 */
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

// studySessions.ts imports `resolveUser` (read-only) and
// `requireUser` (lazy-create) from `convex/users.ts`. See users.ts
// for the auth design + the lazy-create behavior.

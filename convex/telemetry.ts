import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireUser, resolveUserReadOnly as resolveUser } from "./users";

/**
 * recordAiGeneration.
 *
 * Logs an AI call to the `aiGenerations` table. Per AGENTS.md:
 * "Every AI generation must be logged to the AiGeneration
 * table with usage metrics, model info, and schema validation
 * results." This is the single entry point for that log.
 *
 * The mutation resolves the calling user from the Clerk
 * identity (so the caller — typically a Route Handler using
 * a Clerk-authenticated ConvexHttpClient — only needs to
 * pass the per-call metrics, not the Convex user id).
 */
export const recordAiGeneration = mutation({
  args: {
    task: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
    schemaValid: v.boolean(),
    relatedId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);

    await ctx.db.insert("aiGenerations", {
      userId: user._id,
      task: args.task,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      latencyMs: args.latencyMs,
      schemaValid: args.schemaValid,
      ...(args.relatedId !== undefined ? { relatedId: args.relatedId } : {}),
    });

    return null;
  },
});

// telemetry.ts imports the lazy-create `requireUser` from
// `convex/users.ts` so AI generation writes from a brand-new user
// (before the Clerk webhook has fired) do not throw. See users.ts.

/**
 * getRecentSystemUpdates.
 *
 * Powers the dashboard's "What's new" feed (plan §4.4).
 * Returns the most recent 3 `aiGenerations` rows that
 * resulted in lesson regeneration or new topic
 * creation, scoped to the current user.
 *
 * The `task` discriminator in `aiGenerations` is the
 * routing key. Plan §4.4 only asks for two task kinds
 * ("lesson_regenerate" and "topic_create") so we filter
 * server-side. A future task kind (e.g. a per-topic
 * "explain" run) will be added to the allow-list here
 * without changing the call sites.
 *
 * Each row has a `relatedId` (the topic or lesson id
 * the generation targeted). We hydrate the related
 * topic + subject so the strip can render a deep link
 * without the dashboard doing extra round-trips.
 *
 * Returns an empty array when the user has no
 * qualifying activity. The dashboard hides the strip
 * in that case so a fresh sign-up never sees a
 * confusing empty card.
 */
export const getRecentSystemUpdates = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      task: v.literal("generateCourseLesson"),
      at: v.number(),
      model: v.string(),
      href: v.union(v.string(), v.null()),
      headline: v.string(),
    })
  ),
  handler: async (ctx, { limit }) => {
    const cap = Math.max(1, Math.min(limit ?? 3, 10));
    const user = await resolveUser(ctx);
    if (!user) return [];

    // Two scoped collects, one per task kind. Each is
    // bounded by the `by_user_task` index; the in-memory
    // sort + slice keeps the per-side count to `cap` so
    // the response stays small.
    const lessons = await ctx.db
      .query("aiGenerations")
      .withIndex("by_user_task", (q) =>
        q.eq("userId", user._id).eq("task", "generateCourseLesson")
      )
      .take(cap);
    lessons.sort((a, b) => b._creationTime - a._creationTime);
    const top = lessons;

    const out: Array<{
      task: "generateCourseLesson";
      at: number;
      model: string;
      href: string | null;
      headline: string;
    }> = [];
    for (const r of top) {
      let href: string | null = null;
      let headline = "AI generation";
      if (r.relatedId) {
        // The `relatedId` is the topicId for both
        // task kinds. Try to resolve to a real URL;
        // if the topic has been deleted we surface a
        // null href and let the client render a
        // quiet caption instead of a broken link.
        const topic = await ctx.db.get(r.relatedId as Id<"topics">);
        if (topic) {
          const chapter = await ctx.db.get(topic.chapterId);
          if (chapter) {
            const subject = await ctx.db.get(chapter.subjectId);
            if (subject) {
              href =
                topic.source === "user"
                  ? `/my-topics/${topic.slug}/lesson`
                  : `/subjects/${subject.slug}/${chapter.slug}/${topic.slug}`;
              headline = `Regenerated ${topic.title}`;
            }
          }
        }
      }
      out.push({
        task: r.task as "generateCourseLesson",
        at: r._creationTime,
        model: r.model,
        href,
        headline,
      });
    }
    return out;
  },
});

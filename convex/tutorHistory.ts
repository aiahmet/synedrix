import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { resolveUserReadOnly as resolveUser } from "./users";

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
    const start = Date.now();
    const user = await resolveUser(ctx);
    if (!user) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] listThreadsForSidebar took ${ms}ms`);
      return [];
    }

    // Cap at 100 threads for sidebar rendering.
    const threads = await ctx.db
      .query("tutorThreads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(100);

    if (threads.length === 0) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] listThreadsForSidebar took ${ms}ms`);
      return [];
    }

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

    const rows = threads.map((t) => {
      return {
        id: t._id,
        title: t.title ?? null,
        subjectId: t.subjectId ?? null,
        topicId: t.topicId ?? null,
        lastReadAt: t.lastReadAt ?? null,
        createdAt: t._creationTime,
        lastMessageAt: t.lastMessageAt ?? t._creationTime,
        lastMessagePreview: t.lastMessagePreview ?? null,
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

    const ms = Date.now() - start;
    if (ms > 500) console.warn(`[tutor-telemetry] listThreadsForSidebar took ${ms}ms`);
    return groups;
  },
});

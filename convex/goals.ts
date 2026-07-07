import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import { requireUser } from "./users";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("goals"),
      subjectId: v.union(v.id("subjects"), v.null()),
      title: v.string(),
      type: v.union(v.literal("daily"), v.literal("weekly")),
      targetCount: v.union(v.number(), v.null()),
      completedCount: v.number(),
      deadline: v.union(v.number(), v.null()),
      subjectTitle: v.union(v.string(), v.null()),
      subjectColor: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];
    const goals = await ctx.db
      .query("goals")
      .withIndex("by_user_type", (q) => q.eq("userId", user._id))
      .collect();

    const subjectIds = Array.from(
      new Set(
        goals
          .map((g) => g.subjectId)
          .filter((id): id is Id<"subjects"> => id !== undefined)
      )
    );
    const subjectRows =
      subjectIds.length > 0
        ? await Promise.all(subjectIds.map((id) => ctx.db.get(id)))
        : [];
    const subjectMap = new Map<Id<"subjects">, Doc<"subjects">>();
    for (const s of subjectRows) {
      if (s) subjectMap.set(s._id, s);
    }

    return goals.map((g) => {
      const subject = g.subjectId ? subjectMap.get(g.subjectId) : undefined;
      return {
        id: g._id,
        subjectId: g.subjectId ?? null,
        title: g.title,
        type: g.type,
        targetCount: g.targetCount ?? null,
        completedCount: g.completedCount ?? 0,
        deadline: g.deadline ?? null,
        subjectTitle: subject?.title ?? null,
        subjectColor: subject?.color ?? null,
      };
    });
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    type: v.union(v.literal("daily"), v.literal("weekly")),
    subjectId: v.optional(v.id("subjects")),
    targetCount: v.optional(v.number()),
    deadline: v.optional(v.number()),
  },
  returns: v.id("goals"),
  handler: async (ctx, args): Promise<Id<"goals">> => {
    const user = await requireUser(ctx);
    return await ctx.db.insert("goals", {
      userId: user._id,
      title: args.title,
      type: args.type,
      subjectId: args.subjectId,
      targetCount: args.targetCount,
      completedCount: 0,
      deadline: args.deadline,
    });
  },
});

export const update = mutation({
  args: {
    goalId: v.id("goals"),
    title: v.optional(v.string()),
    targetCount: v.optional(v.number()),
    completedCount: v.optional(v.number()),
    deadline: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.userId !== user._id) return null;

    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.targetCount !== undefined) patch.targetCount = args.targetCount;
    if (args.completedCount !== undefined)
      patch.completedCount = args.completedCount;
    if (args.deadline !== undefined) patch.deadline = args.deadline;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.goalId, patch);
    }
    return null;
  },
});

export const increment = mutation({
  args: {
    goalId: v.id("goals"),
  },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    const user = await requireUser(ctx);
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.userId !== user._id) return 0;

    const next = (goal.completedCount ?? 0) + 1;
    await ctx.db.patch(args.goalId, { completedCount: next });
    return next;
  },
});

export const remove = mutation({
  args: {
    goalId: v.id("goals"),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.userId !== user._id) return null;

    await ctx.db.delete(args.goalId);
    return null;
  },
});

export const getSnapshot = query({
  args: {},
  returns: v.object({
    daily: v.array(
      v.object({
        id: v.id("goals"),
        title: v.string(),
        targetCount: v.union(v.number(), v.null()),
        completedCount: v.number(),
        subjectTitle: v.union(v.string(), v.null()),
        subjectColor: v.union(v.string(), v.null()),
      })
    ),
    weekly: v.array(
      v.object({
        id: v.id("goals"),
        title: v.string(),
        targetCount: v.union(v.number(), v.null()),
        completedCount: v.number(),
        deadline: v.union(v.number(), v.null()),
        subjectTitle: v.union(v.string(), v.null()),
        subjectColor: v.union(v.string(), v.null()),
      })
    ),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { daily: [], weekly: [] };
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return { daily: [], weekly: [] };
    const goals = await ctx.db
      .query("goals")
      .withIndex("by_user_type", (q) => q.eq("userId", user._id))
      .collect();

    const subjectIds = Array.from(
      new Set(
        goals
          .map((g) => g.subjectId)
          .filter((id): id is Id<"subjects"> => id !== undefined)
      )
    );
    const subjectRows =
      subjectIds.length > 0
        ? await Promise.all(subjectIds.map((id) => ctx.db.get(id)))
        : [];
    const subjectMap = new Map<Id<"subjects">, Doc<"subjects">>();
    for (const s of subjectRows) {
      if (s) subjectMap.set(s._id, s);
    }

    const mapGoal = (g: Doc<"goals">) => {
      const subject = g.subjectId ? subjectMap.get(g.subjectId) : undefined;
      return {
        id: g._id,
        title: g.title,
        targetCount: g.targetCount ?? null,
        completedCount: g.completedCount ?? 0,
        subjectTitle: subject?.title ?? null,
        subjectColor: subject?.color ?? null,
      };
    };

    const daily = goals
      .filter((g) => g.type === "daily")
      .map(mapGoal)
      .slice(0, 6);

    const weekly = goals
      .filter((g) => g.type === "weekly")
      .map((g) => ({
        ...mapGoal(g),
        deadline: g.deadline ?? null,
      }))
      .slice(0, 6);

    return { daily, weekly };
  },
});

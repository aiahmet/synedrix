import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";

import { requireUser, resolveUserReadOnly as resolveUser } from "./users";

export const listByTopic = query({
  args: { topicId: v.id("topics") },
  returns: v.array(
    v.object({
      id: v.id("notes"),
      title: v.string(),
      content: v.string(),
      pinned: v.optional(v.boolean()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, { topicId }) => {
    const user = await resolveUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("notes")
      .withIndex("by_topic", (q) =>
        q.eq("topicId", topicId)
      )
      .collect();
    const userRows = rows.filter((r) => r.userId === user._id);
    userRows.sort((a, b) => b._creationTime - a._creationTime);
    return userRows.map((r) => ({
      id: r._id,
      title: r.title,
      content: r.content,
      pinned: r.pinned,
      createdAt: r._creationTime,
    }));
  },
});

export const create = mutation({
  args: {
    topicId: v.id("topics"),
    title: v.string(),
    content: v.string(),
    pinned: v.optional(v.boolean()),
  },
  returns: v.id("notes"),
  handler: async (ctx, { topicId, title, content, pinned }) => {
    const user = await requireUser(ctx);
    const noteId = await ctx.db.insert("notes", {
      userId: user._id,
      topicId,
      title: title.trim(),
      content: content.trim(),
      pinned: pinned ?? false,
    });
    return noteId;
  },
});

export const update = mutation({
  args: {
    noteId: v.id("notes"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { noteId, title, content, pinned }) => {
    const user = await requireUser(ctx);
    const note = await ctx.db.get(noteId);
    if (!note) throw new ConvexError("note_not_found");
    if (note.userId !== user._id) throw new ConvexError("forbidden");

    const patch: Record<string, unknown> = {};
    if (title !== undefined) patch.title = title.trim();
    if (content !== undefined) patch.content = content.trim();
    if (pinned !== undefined) patch.pinned = pinned;

    await ctx.db.patch(noteId, patch);
    return null;
  },
});

export const togglePin = mutation({
  args: { noteId: v.id("notes") },
  returns: v.boolean(),
  handler: async (ctx, { noteId }) => {
    const user = await requireUser(ctx);
    const note = await ctx.db.get(noteId);
    if (!note) throw new ConvexError("note_not_found");
    if (note.userId !== user._id) throw new ConvexError("forbidden");

    const next = !(note.pinned ?? false);
    await ctx.db.patch(noteId, { pinned: next });
    return next;
  },
});

export const remove = mutation({
  args: { noteId: v.id("notes") },
  returns: v.null(),
  handler: async (ctx, { noteId }) => {
    const user = await requireUser(ctx);
    const note = await ctx.db.get(noteId);
    if (!note) throw new ConvexError("note_not_found");
    if (note.userId !== user._id) throw new ConvexError("forbidden");
    await ctx.db.delete(noteId);
    return null;
  },
});

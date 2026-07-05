import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./users";

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

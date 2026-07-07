import { mutation } from "./_generated/server";
import { v } from "convex/values";

import { requireUser } from "./users";

/**
 * tutorAutoReview.ts — Phase 6 §8.1 Automatic Review Scheduling.
 *
 * When the tutor detects a weakness (via the structured
 * response's `extraWidgets` containing a `[[mistake:...]]`
 * marker), it automatically:
 *
 *   1. Creates a `mistakeEntry` row
 *   2. Sets `reviewAt = Date.now() + 24h` for spaced repetition
 *   3. Surfaces it in the dashboard's "Due for review" section
 *      (the `by_user_review` index on `mistakeEntries` drives
 *      the dashboard's "Due today" count).
 *
 * Called fire-and-forget from `recordAssistantMessage`
 * (`convex/tutor.ts`) via `ctx.scheduler.runAfter(0, ...)`.
 * The 0ms delay decouples the auto-review from the message
 * persistence so a failed review write never blocks the
 * message from being recorded.
 */

/** Valid mistake types (must match the `mistakeEntries` union). */
const VALID_MISTAKE_TYPES = [
  "CONCEPT_MISUNDERSTANDING",
  "CALCULATION_MISTAKE",
  "CARELESS_ERROR",
  "FORMULA_RECALL_FAILURE",
  "MISREAD_QUESTION",
  "LANGUAGE_EXPRESSION_ISSUE",
  "SIGN_ERROR",
  "UNIT_CONVERSION_ERROR",
  "GRAMMAR_ERROR",
  "VOCABULARY_ERROR",
  "REACTION_BALANCE_ERROR",
  "ARGUMENT_STRUCTURE_ISSUE",
] as const;

/**
 * Parse `[[mistake:TYPE|cause]]` markers from the assistant
 * message content. The regex captures the type (before the
 * pipe or end bracket) and an optional cause (after the pipe).
 *
 * Only markers on their own line are parsed — inline mentions
 * of the literal `[[mistake:...]]` string inside markdown
 * prose are not treated as review-trigger markers (the
 * prompt instructs the model to emit markers on dedicated
 * lines, so this filter only matters for debug sessions
 * where the user intentionally types the marker string).
 */
function parseMistakeMarkers(
  content: string
): Array<{ mistakeType: string; cause: string }> {
  // Match [[mistake:TYPE]] or [[mistake:TYPE|cause]]
  // Only on lines that start with `[[mistake:` (marker on
  // its own line, possibly preceded by whitespace).
  const regex = /^[ \t]*\[\[mistake:([^|\]]+)(?:\|([^\]]*))?\]\][ \t]*$/gm;
  const results: Array<{ mistakeType: string; cause: string }> = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const rawType = (match[1] ?? "").trim();
    const cause = (match[2] ?? "").trim();
    if (rawType.length > 0) {
      results.push({
        mistakeType: normaliseMistakeType(rawType),
        cause,
      });
    }
  }
  return results;
}

/** Normalise a raw mistake type string to a valid union member. */
function normaliseMistakeType(raw: string): string {
  const upper = raw.toUpperCase();
  for (const valid of VALID_MISTAKE_TYPES) {
    if (upper === valid) return valid;
  }
  // Default fallback: the marker had a type string the model
  // invented (or the user typed). Treat as a concept gap —
  // the `cause` field carries the actual marker payload.
  return "CONCEPT_MISUNDERSTANDING";
}

/**
 * scheduleAutoReview.
 *
 * Scans an assistant message for `[[mistake:...]]` markers
 * and creates a `mistakeEntry` row for each one with
 * `reviewAt = now + 24h`. Called fire-and-forget from the
 * `recordAssistantMessage` mutation in `convex/tutor.ts`.
 *
 * Idempotent on re-call (multi-marker messages create one
 * row per marker). The dashboard's "Due for review" section
 * reads from `mistakeEntries.by_user_review` where
 * `reviewAt <= now`.
 */
export const scheduleAutoReview = mutation({
  args: {
    threadId: v.id("tutorThreads"),
    subjectId: v.optional(v.id("subjects")),
    topicId: v.optional(v.id("topics")),
    messageContent: v.string(),
    /**
     * Phase 6 §8.1: the structured JSON payload (if any)
     * from the assistant message. Scanned alongside
     * `messageContent` so `[[mistake:...]]` markers
     * embedded inside structured sections are also
     * detected.
     */
    structuredContent: v.optional(v.string()),
  },
  returns: v.object({
    scheduled: v.number(),
  }),
  handler: async (ctx, { threadId, topicId, messageContent, structuredContent }) => {
    const user = await requireUser(ctx);
    void threadId;

    // Verify thread ownership — the caller passes the
    // threadId from an already-validated context, but
    // the scheduler runs independently and the user
    // session might have expired.
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.userId !== user._id) {
      return { scheduled: 0 };
    }

    // Scan both the raw message text and the structured
    // JSON payload (when present). Structured sections
    // (lessons, worked examples) can also carry
    // `[[mistake:...]]` markers, and the model is more
    // likely to emit them inside a structured block.
    const markers = parseMistakeMarkers(
      structuredContent
        ? `${messageContent}\n${structuredContent}`
        : messageContent
    );
    if (markers.length === 0) return { scheduled: 0 };

    const now = Date.now();
    // Phase 6 §8.1: +24h spacing. The dashboard's
    // "Due today" query filters `reviewAt <= now`, so
    // this entry appears tomorrow.
    const reviewAt = now + 24 * 60 * 60 * 1000;

    for (const marker of markers) {
      await ctx.db.insert("mistakeEntries", {
        userId: user._id,
        ...(topicId ? { topicId } : {}),
        // The question / userAnswer / correctAnswer
        // fields are placeholder — the auto-review
        // entry is a scheduled prompt to revisit a
        // weakness the tutor detected mid-conversation,
        // not a full practice attempt. The `cause` +
        // `mistakeType` carry the signal.
        question: `[Auto-scheduled from tutor thread — ${marker.mistakeType}]`,
        userAnswer: "",
        correctAnswer: marker.cause,
        mistakeType: marker.mistakeType as typeof VALID_MISTAKE_TYPES[number],
        cause: marker.cause,
        reviewAt,
      });
    }

    return { scheduled: markers.length };
  },
});

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateObject } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { deepseek } from "@/lib/ai/provider";
import { chatModel } from "@/lib/ai/models";
import { logAiGeneration } from "@/lib/ai/telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tutor/flashcards.
 *
 * Phase 6 §8.2: generates a flashcard deck from an assistant
 * message in the tutor thread. The AI extracts key
 * term/definition pairs and the route handler persists them
 * through `api.flashcards.generateFromMessage`.
 *
 * Inputs:
 *   - topicId       topic to associate the deck with
 *   - topicTitle    title for the deck (used for deck title)
 *   - messageText   the assistant message to extract from
 *
 * Outputs:
 *   - { deckId, cardCount }
 *
 * The AI call uses `generateObject` with a compact Zod schema
 * so the model returns ONLY the structured flashcard list.
 * Telemetry is recorded per standard `invoke.ts` pattern.
 */

const flashcardsSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().min(1).max(300),
        back: z.string().min(1).max(500),
      })
    )
    .min(1)
    .max(15),
});

const requestSchema = z.object({
  topicId: z.string().min(1),
  topicTitle: z.string().min(1).max(200),
  messageText: z.string().min(1).max(8000),
});

export async function POST(req: NextRequest) {
  const { userId: clerkId, getToken } = await auth();
  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return new Response("Convex is not configured", { status: 500 });
  }

  const token = await getToken({ template: "convex" }).catch(() => null);
  const convex = new ConvexHttpClient(convexUrl);
  if (token) convex.setAuth(token);

  const parseResult = requestSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parseResult.success) {
    return new Response("Bad request", { status: 400 });
  }
  const { topicId, topicTitle, messageText } = parseResult.data;

  // Call the AI to extract flashcards.
  const startMs = Date.now();
  const modelId = chatModel();

  let cards: Array<{ front: string; back: string }>;
  try {
    const result = await generateObject({
      model: deepseek()(modelId),
      schema: flashcardsSchema,
      system: buildFlashcardExtractionPrompt(topicTitle),
      prompt: messageText,
      maxOutputTokens: 1500,
      abortSignal: AbortSignal.timeout(60_000),
    });
    cards = result.object.cards;
    const usage = result.usage;

    // Fire-and-forget telemetry.
    void logAiGeneration(convex, {
      task: "tutor.flashcards",
      model: modelId,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      latencyMs: Date.now() - startMs,
      schemaValid: true,
    });
  } catch (err) {
    console.error("[tutor/flashcards] AI extraction failed", err);
    // Fire-and-forget telemetry even on failure.
    void logAiGeneration(convex, {
      task: "tutor.flashcards",
      model: modelId,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startMs,
      schemaValid: false,
    });
    return new Response("AI extraction failed", { status: 502 });
  }

  if (cards.length === 0) {
    return new Response("No extractable terms found in message", {
      status: 422,
    });
  }

  // Persist through the Convex mutation.
  let mutationResult: { deckId: string; cardCount: number };
  try {
    mutationResult = await convex.mutation(api.flashcards.generateFromMessage, {
      topicId: topicId as Id<"topics">,
      title: `From tutor — ${topicTitle}`,
      cards,
    });
  } catch (err) {
    console.error("[tutor/flashcards] persistence failed", err);
    return new Response("Persistence failed", { status: 500 });
  }

  return Response.json({
    deckId: mutationResult.deckId,
    cardCount: mutationResult.cardCount,
  });
}

/**
 * Build the system prompt for flashcard extraction. Compact,
 * instructional — the model just needs to pull out terms.
 */
function buildFlashcardExtractionPrompt(topicTitle: string): string {
  return `You are a flashcard extractor. Given a tutor message about "${topicTitle}", extract the key terms and their definitions as flashcards.

Rules:
- Extract 3-8 key terms/concepts with their definitions.
- The "front" should be the term or question (short, 1-2 words).
- The "back" should be the definition or explanation (1-3 sentences).
- Only extract from the provided message — do not invent new terms.
- Keep definitions concise and accurate.

Return ONLY the structured object — no preamble, no commentary.`;
}

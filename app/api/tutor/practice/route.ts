import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generatePracticeFromConversation } from "@/lib/ai/invoke";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tutor/practice.
 *
 * Phase 3 §5.2: the inline tutor practice generator.
 *
 * Inputs:
 *   - threadId       anchor for the inline session
 *   - subjectId, topicId, anchorMessageId
 *                    + the recent turn transcript
 *
 * Outputs:
 *   - { sessionId, itemIds }
 *
 * The route handler does the AI work (calling
 * `generatePracticeFromConversation`) and persists the
 * validated bundle via `api.tutorPractice.createInlineSession`.
 * Mirrors the role split used by
 * `/api/topics/practice/start` (per AGENTS.md: AI plumbing
 * outside the Convex surface).
 */
const requestSchema = z.object({
  threadId: z.string().min(1),
  subjectId: z.string().min(1),
  topicId: z.string().min(1).optional(),
  topicTitle: z.string().min(1).max(200),
  anchorMessageId: z.string().min(1).max(128),
  /** Last N turns of the live thread (caller decides N). */
  turns: z
    .array(
      z.object({
        role: z.union([z.literal("user"), z.literal("assistant")]),
        text: z.string().min(1).max(8000),
      })
    )
    .min(1)
    .max(20),
  gradeLevel: z.union([z.string(), z.null()]),
  language: z.string().min(2).max(8),
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
  const body = parseResult.data;

  // Zod fails fast when topicId is missing — the Convex
  // mutation enforces the same invariant. A subject-only
  // thread (no topic pinned) does NOT currently ship
  // inline practice; surfacing a 400 is honest.
  if (!body.topicId) {
    return new Response(
      "topicId required for inline practice",
      { status: 400 }
    );
  }

  // Branded ids for the Convex mutation. Zod accepted
  // them as strings; the cast is the explicit boundary
  // — everything below this line is fully typed.
  const threadId = body.threadId as Id<"tutorThreads">;
  const subjectId = body.subjectId as Id<"subjects">;
  const topicId = body.topicId as Id<"topics">;

  // Call the AI. Resolve the subject slug so the prompt
  // builder can inject subject-specific guidance
  // (preferredQuestionTypes, tutorInstructions) from
  // getSubjectBehavior().
  const subjectSlug = await convex
    .query(api.tutorPractice.getSubjectSlug, { subjectId })
    .catch(() => null);

  const result = await generatePracticeFromConversation(
    convex,
    {
      turns: body.turns,
      topicTitle: body.topicTitle,
      gradeLevel:
        body.gradeLevel === null || body.gradeLevel === undefined
          ? null
          : body.gradeLevel,
      language: body.language,
      count: 3,
      ...(subjectSlug ? { subjectSlug } : {}),
    },
    threadId
  );

  if (!result.ok) {
    // `result.error` only exists on the `ai_error`
    // branch; the Zod-failed branch has no error
    // payload. Narrow on `result.reason` so we never
    // dereference a missing field.
    if (result.reason === "zod_failed") {
      console.error("[tutor/practice] AI output failed Zod validation");
    } else if (result.reason === "ai_error") {
      console.error("[tutor/practice] AI call failed", result.error);
    }
    return new Response("AI generation failed", { status: 502 });
  }

  // Persist via the Convex mutation.
  let mutationResult:
    | {
        sessionId: string;
        practiceSetId: string;
        itemIds: string[];
      }
    | null = null;
  try {
    mutationResult = await convex.mutation(
      api.tutorPractice.createInlineSession,
      {
        threadId,
        subjectId,
        topicId,
        anchorMessageId: body.anchorMessageId,
        topicTitle: body.topicTitle,
        items: result.value.items.map((it) => ({
          prompt: it.prompt,
          expectedAnswer: it.expectedAnswer,
          skill: it.skill,
          rubric: it.rubric,
        })),
      }
    );
  } catch (err) {
    console.error("[tutor/practice] createInlineSession failed", err);
    return new Response("Persistence failed", { status: 500 });
  }

  return Response.json({
    sessionId: mutationResult.sessionId,
    practiceSetId: mutationResult.practiceSetId,
    itemIds: mutationResult.itemIds,
  });
}

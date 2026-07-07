import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { streamLesson } from "@/lib/ai/invoke";
import { chatModel } from "@/lib/ai/models";
import { lessonSchema } from "@/lib/ai/prompts/lesson";

// Node.js runtime — ConvexHttpClient + Clerk auth need
// the full Node API surface. Streaming responses work
// fine under Next.js 16 here.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Zod schema for the request body. Matches `createUserTopic`
 * in `convex/topics.ts` minus the `lesson` object — the
 * route handler generates that and supplies it to the
 * mutation.
 */
const requestSchema = z.object({
  subjectTitle: z.string().min(1),
  subjectSlug: z.string().min(1),
  chapterId: z.string().min(1),
  title: z.string().min(1).max(120),
  brief: z.string().min(1).max(2000),
  difficulty: z.union([z.literal("EASY"), z.literal("MEDIUM"), z.literal("HARD")]),
  depth: z.union([z.literal("simple"), z.literal("standard"), z.literal("rigorous")]),
  objectives: z.array(z.string()).optional(),
  gradeLevel: z.string().optional(),
});

/**
 * POST /api/topics/lesson/stream.
 *
 * Streams the AI-generated lesson structure to the
 * client (live "types in" UX) and, on stream completion,
 * commits the topic + topicLessons rows via the
 * Convex mutation `api.topics.createUserTopic`.
 *
 * Architecture: the route handler is the only place AI
 * plumbing lives AND the only place the canonical commit
 * fires. The client never invokes the mutation directly.
 *
 * Per AGENTS.md ("AI plumbing outside the Convex
 * surface"), the actual `streamObject` + telemetry call
 * is delegated to `streamLesson()` from
 * `src/lib/ai/invoke.ts`. This route only owns
 * route-specific concerns: request validation, auth, and
 * the "background commit on stream completion" pattern.
 *
 * `result.object` (AI SDK v7) is the Promise<T> for the
 * final structured value; `result.toTextStreamResponse()`
 * hands the live async iterable the client subscribes to
 * via `experimental_useObject` from `@ai-sdk/react`. On
 * stream completion we commit the canonical row
 * server-side; the client does not wait for it (the
 * "Opening lesson →" prompt uses the optimistic slug
 * derived from the title).
 */
export async function POST(req: NextRequest) {
  // 1. Auth.
  const { userId: clerkId, getToken } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return new Response("Convex is not configured", { status: 500 });
  }

  const token = await getToken({ template: "convex" }).catch(() => null);
  const convex = new ConvexHttpClient(convexUrl);
  if (token) convex.setAuth(token);

  // 2. Parse + validate the request body.
  const parsed = requestSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) {
    return new Response("Bad request", { status: 400 });
  }
  const input = parsed.data;

  // 3. Begin streaming the lesson via the centralized
  //    helper. `streamLesson` returns the Vercel AI SDK
  //    `streamObject` result; telemetry fires
  //    fire-and-forget inside the helper so the streaming
  //    response itself is unblocked. We also propagate
  //    the client's abort signal so a closed tab cancels
  //    the model run.
  let result;
  try {
    result = streamLesson(convex, {
      subjectTitle: input.subjectTitle,
      subjectSlug: input.subjectSlug,
      topicTitle: input.title,
      brief: input.brief,
      objectives: input.objectives ?? [],
      gradeLevel: input.gradeLevel ?? null,
      difficulty: input.difficulty,
      depth: input.depth,
      language: "de",
    }, { abortSignal: req.signal });
  } catch (err) {
    console.error("lesson stream: streamLesson init failed", err);
    return new Response("Internal error", { status: 500 });
  }

  // 4. Background commit on stream completion. This is
  //    the only route-specific concern that's NOT in the
  //    centralized helper — the commit writes a Convex
  //    row with user-account-scoped foreign keys, which
  //    is by design a route concern (AI plumbing lives in
  //    `src/lib/ai/`, persistent state writes live in the
  //    route handler / Convex mutation boundary).
  void (async () => {
    try {
      if (req.signal.aborted) return;
      const finalObject = await result.object;
      if (req.signal.aborted) return;

      let lessonData;
      const parseResult = lessonSchema.safeParse(finalObject);
      if (!parseResult.success) {
        console.error(
          "lesson stream: final object failed Zod, creating degraded placeholder:",
          parseResult.error.message
        );
        lessonData = {
          sections: [
            {
              heading: "Generierung fehlgeschlagen",
              body: `Die strukturierte Antwort der KI entsprach nicht den Qualitätskriterien. Bitte klicke unten auf „Regenerieren“, um das Thema neu zu erstellen. Details: ${parseResult.error.message}`,
            },
          ],
          glossary: [],
        };
      } else {
        lessonData = parseResult.data;
      }

      // Capture the real model id here. The `streamLesson`
      // helper logs the same id in telemetry, but the canonical
      // `topicLessons.model` row needs the resolved value too —
      // passing a placeholder ("delegated-from-route") meant
      // every regenerated lesson's model field was a string with
      // no diagnostic value. `chatModel()` returns the env-
      // resolved default and is the same value the AI SDK call
      // runs with; the route handler and the helper are now
      // consistent.
      await convex.mutation(api.topics.createUserTopic, {
        chapterId: input.chapterId as Id<"chapters">,
        title: input.title,
        brief: input.brief,
        difficulty: input.difficulty,
        depth: input.depth,
        objectives: input.objectives ?? [],
        ...(input.gradeLevel ? { gradeLevel: input.gradeLevel } : {}),
        model: chatModel(),
        lesson: lessonData,
      });
    } catch (err) {
      console.error("lesson stream: background commit failed", err);
    }
  })();

  return result.toTextStreamResponse();
}

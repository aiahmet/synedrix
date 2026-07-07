import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { generateText } from "ai";
import { z } from "zod";

import { deepseek } from "@/lib/ai/provider";
import { chatModel } from "@/lib/ai/models";
import { logAiGeneration } from "@/lib/ai/telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  content: z.string().min(100).max(12000),
  topicTitle: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const { userId: clerkId, getToken } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return new Response("Convex is not configured", { status: 500 });
  }

  const token = await getToken({ template: "convex" }).catch(() => null);
  const convex = new ConvexHttpClient(convexUrl);
  if (token) convex.setAuth(token);

  const parsed = requestSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) {
    return new Response("Bad request", { status: 400 });
  }

  const { content, topicTitle } = parsed.data;
  const modelId = chatModel();
  const startMs = Date.now();

  const promptContext = topicTitle ? ` on "${topicTitle}"` : "";

  try {
    const result = await generateText({
      model: deepseek()(modelId),
      system: `You are a study-notes summariser for a German Gymnasium student. 
Read the lesson content provided and produce a concise, structured summary in 5-8 bullet points.
Each bullet point should be a complete sentence. Group related concepts together.
Use plain text only — no markdown headers, no code blocks, no math delimiters.
Write in the same language as the lesson content.`,
      prompt: `Summarise the following lesson content${promptContext} into concise study notes (5-8 bullet points, plain text):\n\n${content.slice(0, 10000)}`,
      maxOutputTokens: 800,
      abortSignal: req.signal,
    });

    const responseText = result.text.trim();

    void logAiGeneration(convex, {
      task: "summarizeTopicNotes",
      model: modelId,
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      latencyMs: Date.now() - startMs,
      schemaValid: true,
    }).catch(() => {});

    return Response.json({ summary: responseText });
  } catch {
    void logAiGeneration(convex, {
      task: "summarizeTopicNotes",
      model: modelId,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startMs,
      schemaValid: false,
    }).catch(() => {});

    if (req.signal.aborted) {
      return new Response("Request cancelled", { status: 499 });
    }

    return new Response("Summarisation failed", { status: 500 });
  }
}

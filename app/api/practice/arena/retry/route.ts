import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  parentRunId: z.string().min(1),
  wrongItemIds: z.array(z.string().min(1)).min(1),
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

  const { parentRunId, wrongItemIds } = parsed.data;

  try {
    const result = await convex.mutation(
      api.practiceArena.retryWrongItems,
      {
        parentRunId: parentRunId as Id<"topicLessonPractice">,
        wrongItemIds: wrongItemIds as Id<"practiceItems">[],
      }
    );
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("/api/practice/arena/retry: mutation failed", err);
    return new Response("Internal error", { status: 500 });
  }
}

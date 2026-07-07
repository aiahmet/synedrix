import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { generateText } from "ai";

import { api } from "@/convex/_generated/api";
import { deepseek } from "@/lib/ai/provider";
import { chatModel } from "@/lib/ai/models";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

const RESCUE_PROMPT = `You are a study coach for a German Gymnasium student. The student has several overdue review items and is overwhelmed. Your job is to generate ONE focused rescue plan — a single paragraph (max 120 words, in German) that:

1. Names the 1-3 most important topics to address right now, in order of priority.
2. Explains WHY each topic matters (exam relevance, prerequisite, or recurring weakness).
3. Suggests ONE concrete action ("work through 3 practice questions on X", "review the formula sheet for Y", etc.).

Do NOT list every overdue item. Pick the top priorities. The student needs focus, not more overwhelm. Return ONLY the German paragraph, no markdown, no bullet points, no preamble.`;

export async function POST() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const token = await getToken({ template: "convex" }).catch(() => null);
    const convex = getConvexClient();
    if (token) convex.setAuth(token);

    const queue = await convex.query(
      api.reviewCenter.getReviewQueue,
      {},
    );

    const overdueItems = queue.items.filter((i) => i.priority >= 0.9);

    if (overdueItems.length === 0) {
      return NextResponse.json({ redirectUrl: "/review" });
    }

    const itemSummary = overdueItems
      .slice(0, 8)
      .map((i) => `- ${i.kind}: ${i.title} (${i.subtitle})`)
      .join("\n");

    let rescueMessage = "";
    try {
      const result = await generateText({
        model: deepseek()(chatModel()),
        system: RESCUE_PROMPT,
        prompt: `The student has ${overdueItems.length} overdue review items:\n\n${itemSummary}\n\nGenerate the rescue plan in German.`,
        maxOutputTokens: 300,
      });
      rescueMessage = result.text.trim();
    } catch {
      rescueMessage =
        `Du hast ${overdueItems.length} überfällige Wiederholungen. Fokussiere dich jetzt auf die wichtigsten Themen und arbeite sie in dieser Sitzung durch.`;
    }

    const firstSubjectSlug =
      overdueItems.find((i) => i.subjectSlug)?.subjectSlug ?? "";

    const params = new URLSearchParams();
    if (firstSubjectSlug) {
      params.set("subject", firstSubjectSlug);
    }
    params.set("q", rescueMessage);

    return NextResponse.json({
      redirectUrl: firstSubjectSlug
        ? `/tutor?${params.toString()}`
        : `/review`,
    });
  } catch {
    return NextResponse.json({ redirectUrl: "/review" });
  }
}

"use client";

import { useMemo } from "react";
import type { UIMessage } from "@ai-sdk/react";
import type { Id } from "@/convex/_generated/dataModel";

type ConvexMessage = {
  id: Id<"tutorMessages">;
  role: "user" | "assistant";
  content: string;
  structuredContent?: string;
};

/**
 * Merges Convex-persisted messages with AI SDK live messages,
 * deduplicating by content hash to prevent duplicate rendering.
 *
 * Strategy:
 * 1. Build a Set of content hashes from Convex messages
 * 2. Filter AI SDK messages whose content hash matches (duplicates)
 * 3. Return union: Convex messages first (historical), then AI SDK-only (new)
 */
export function useStableMessages(
  convexMessages: readonly ConvexMessage[] | undefined,
  aiSdkMessages: readonly UIMessage[],
) {
  return useMemo(() => {
    // If Convex hasn't loaded yet, just show AI SDK messages
    if (!convexMessages || convexMessages.length === 0) {
      return aiSdkMessages;
    }

    // Build hash set from Convex messages
    const convexHashes = new Set<string>();
    for (const m of convexMessages) {
      // Hash: role + first 200 chars of content
      const hash = `${m.role}::${m.content.slice(0, 200)}`;
      convexHashes.add(hash);
    }

    // Convert Convex messages to UIMessage format
    const convexUIMessages: UIMessage[] = convexMessages.map((m) => ({
      id: m.id as string,
      role: m.role,
      parts: [{ type: "text", text: m.content }],
      ...(m.structuredContent
        ? { metadata: { structured: m.structuredContent } }
        : {}),
    }));

    // Filter AI SDK messages that are already in Convex (duplicates)
    const aiSdkOnly = aiSdkMessages.filter((m) => {
      const text =
        m.parts
          ?.filter(
            (p): p is { type: "text"; text: string } => p.type === "text",
          )
          .map((p) => p.text)
          .join(" ") ?? "";
      const hash = `${m.role}::${text.slice(0, 200)}`;
      return !convexHashes.has(hash);
    });

    // Return union: Convex messages first (historical), then AI SDK-only (new)
    return [...convexUIMessages, ...aiSdkOnly];
  }, [convexMessages, aiSdkMessages]);
}

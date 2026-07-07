/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";

// Since the hook uses React's useMemo, for testing we extract the merge logic:

function mergeMessages(
  convexMessages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    structuredContent?: string;
  }>,
  aiSdkMessages: Array<{
    id: string;
    role: "user" | "assistant";
    parts: Array<{ type: string; text: string }>;
  }>,
) {
  // Same logic as the hook, extracted for testability
  if (!convexMessages || convexMessages.length === 0) return aiSdkMessages;

  const convexHashes = new Set<string>();
  for (const m of convexMessages) {
    convexHashes.add(`${m.role}::${m.content.slice(0, 200)}`);
  }

  const convexUIMessages = convexMessages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.content }],
    ...(m.structuredContent
      ? { metadata: { structured: m.structuredContent } }
      : {}),
  }));

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

  return [...convexUIMessages, ...aiSdkOnly];
}

describe("useStableMessages", () => {
  it("returns AI SDK messages when Convex is empty", () => {
    const ai = [
      { id: "1", role: "user", parts: [{ type: "text", text: "Hello" }] },
    ];
    expect(mergeMessages([], ai as any)).toEqual(ai);
  });

  it("returns Convex messages when AI SDK is empty", () => {
    const cvx = [{ id: "1", role: "user", content: "Hello" }];
    const result = mergeMessages(cvx as any, []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("deduplicates: full overlap removes AI SDK duplicates", () => {
    const cvx = [{ id: "c1", role: "user", content: "Hello" }];
    const ai = [
      { id: "a1", role: "user", parts: [{ type: "text", text: "Hello" }] },
    ];
    const result = mergeMessages(cvx as any, ai as any);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c1"); // Convex message wins
  });

  it("no overlap: returns both", () => {
    const cvx = [{ id: "c1", role: "user", content: "Old message" }];
    const ai = [
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "New reply" }],
      },
    ];
    const result = mergeMessages(cvx as any, ai as any);
    expect(result).toHaveLength(2);
  });

  it("partial overlap: returns Convex + new AI SDK only", () => {
    const cvx = [
      { id: "c1", role: "user", content: "Hello" },
      { id: "c2", role: "assistant", content: "Hi there!" },
    ];
    const ai = [
      { id: "a1", role: "user", parts: [{ type: "text", text: "Hello" }] }, // duplicate
      {
        id: "a2",
        role: "assistant",
        parts: [{ type: "text", text: "Hi there!" }],
      }, // duplicate
      {
        id: "a3",
        role: "assistant",
        parts: [{ type: "text", text: "New streaming reply" }],
      }, // new
    ];
    const result = mergeMessages(cvx as any, ai as any);
    expect(result).toHaveLength(3); // 2 Convex + 1 new AI SDK
    expect(result[2].id).toBe("a3"); // New one at the end
  });

  it("handles structured content metadata", () => {
    const cvx = [
      {
        id: "c1",
        role: "assistant",
        content: "Reply",
        structuredContent: '{"mode":"exam"}',
      },
    ];
    const ai = [
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "Reply" }],
      },
    ];
    const result = mergeMessages(cvx as any, ai as any);
    expect(result).toHaveLength(1);
    expect((result[0] as any).metadata?.structured).toBe('{"mode":"exam"}');
  });
});

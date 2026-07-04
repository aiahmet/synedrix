/**
 * Shared UIMessage text extractor.
 *
 * The Vercel AI SDK v4+ uses `parts`; older snapshots use
 * `content`. Handle both so the helper stays robust across
 * patches. Used by the tutor route handler (server) and the
 * MessageList (client), so it must be runtime-safe on both.
 */

export interface UiMessageLike {
  readonly content?: string;
  readonly parts?: ReadonlyArray<{ readonly type: string; readonly text?: string }>;
}

export function extractText(message: UiMessageLike): string {
  if (typeof message.content === "string" && message.content.length > 0) {
    return message.content;
  }
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");
  }
  return "";
}

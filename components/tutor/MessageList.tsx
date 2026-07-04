"use client";

import { useEffect, useMemo, useRef } from "react";
import type { UIMessage } from "@ai-sdk/react";

import {
  ChatCircleText,
  Sparkle,
  User as UserIcon,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { extractText } from "@/lib/ai/uiMessage";

/**
 * MessageList.
 *
 * Renders the tutor thread. Driven by Vercel AI SDK's
 * UIMessage shape (so it carries the live streaming
 * content for the assistant's reply). User and assistant
 * messages get distinct visual treatments (right-aligned
 * accent for the user, left-aligned neutral for the
 * assistant) so the conversation reads at a glance. The
 * list auto-scrolls to the bottom on new messages.
 */
export function MessageList({
  messages,
  status,
}: {
  readonly messages: readonly UIMessage[];
  readonly status: "submitted" | "streaming" | "ready" | "error";
}) {
  const bottomRef = useRef<HTMLLIElement>(null);

  // Auto-scroll to the bottom on every render that adds
  // visible content. We track content length so a streaming
  // re-render also scrolls smoothly.
  const totalLength = useMemo(
    () =>
      messages.reduce(
        (acc, m) => acc + extractText(m).length,
        0
      ),
    [messages]
  );
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, totalLength]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
        <ChatCircleText className="h-8 w-8 text-muted-foreground" weight="duotone" />
        <p className="text-[13.5px] font-medium text-foreground">
          No messages yet.
        </p>
        <p className="max-w-sm text-[12.5px] text-muted-foreground">
          The thread is empty. Drop a question below to start the loop.
        </p>
      </div>
    );
  }

  return (
    <ol
      aria-label="Tutor thread"
      className="flex flex-col gap-3 px-1 py-3"
    >
      {messages.map((m) => (
        <li key={m.id}>
          <MessageBubble message={m} />
        </li>
      ))}
      {status === "submitted" && (
        <li aria-live="polite" className="pl-9 text-[12px] text-muted-foreground">
          The tutor is thinking...
        </li>
      )}
      <li aria-hidden ref={bottomRef} className="h-px" />
    </ol>
  );
}

function MessageBubble({ message }: { readonly message: UIMessage }) {
  const isUser = message.role === "user";
  const text = extractText(message);

  return (
    <div
      className={cn(
        "flex w-full gap-2.5",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"
          aria-hidden
        >
          <Sparkle className="h-3.5 w-3.5" weight="duotone" />
        </span>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed sm:max-w-[75%]",
          isUser
            ? "rounded-br-md bg-accent text-accent-foreground"
            : "rounded-bl-md border border-border bg-surface-elevated text-foreground"
        )}
      >
        {text.length > 0 ? text : (isUser ? "" : "...")}
      </div>
      {isUser && (
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
          aria-hidden
        >
          <UserIcon className="h-3.5 w-3.5" weight="duotone" />
        </span>
      )}
    </div>
  );
}

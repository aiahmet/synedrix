"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";
import type { UIMessage } from "@ai-sdk/react";
import { isReasoningUIPart, isTextUIPart } from "ai";
import type { Id } from "@/convex/_generated/dataModel";

import { cn } from "@/lib/utils/cn";
import { extractText } from "@/lib/ai/uiMessage";
import { AIMarkdown } from "@/lib/content/aiMarkdown";
import { parseBlockMarker, BlockWidget } from "@/lib/content/tutorWidgets";
import { ReasoningPart } from "./ReasoningPart";
import { MessageActions } from "./MessageActions";
import { InlinePractice } from "./InlinePractice";
import {
  StructuredResponse,
  tryParseStructured,
} from "./StructuredResponse";

/**
 * MessageList.
 *
 * The chat surface on /tutor. Renders the thread
 * as a single column with no per-message chrome
 * other than the per-message MessageActions
 * toolbar (copy / re-roll / practice). No per-
 * message avatars, no per-message timestamps, no
 * chip strips above or below the conversation.
 *
 * The assistant bubble is text-only (no border,
 * no background, no shadow); the user bubble stays
 * a subtle right-aligned accent block so the chat
 * reads as an asymmetric conversation, not one
 * column of body text.
 */
export function MessageList({
  messages,
  status,
  topicTitle,
  onRegenerate,
  topicId,
  subjectId,
  practiceHref,
  threadId,
  inlinePractices,
  onInlinePracticeRequested,
  onChoicePicked,
}: {
  readonly messages: readonly UIMessage[];
  readonly status: "submitted" | "streaming" | "ready" | "error";
  readonly topicTitle: string | null;
  readonly onRegenerate: (() => void) | undefined;
  readonly topicId: string | null;
  readonly subjectId: Id<"subjects"> | null;
  readonly practiceHref: string | null;
  readonly threadId: string | null;
  readonly inlinePractices: ReadonlyArray<{
    readonly id: Id<"inlineTutorSessions">;
    readonly anchorMessageId: string;
    readonly startedAt: number;
    readonly subjectId: Id<"subjects">;
    readonly topicId: Id<"topics"> | null;
    readonly completedAt: number | null;
  }>;
  readonly onInlinePracticeRequested?: () => void;
  readonly onChoicePicked?: (
    messageId: string,
    signal: { responseTimeMs: number; pickedCorrect: boolean }
  ) => void;
}) {
  const bottomRef = useRef<HTMLLIElement>(null);
  const canRegenerate =
    Boolean(onRegenerate) && (status === "ready" || status === "error");

  const totalLength = useMemo(
    () =>
      messages.reduce(
        (acc, m) =>
          acc +
          m.parts.reduce((partAcc, p) => {
            if (isTextUIPart(p)) return partAcc + p.text.length;
            if (isReasoningUIPart(p)) return partAcc + p.text.length;
            return partAcc;
          }, 0),
        0
      ),
    [messages]
  );

  // Scroll-yank guard. The auto-scroll-to-bottom effect below
  // fires on every streaming chunk; without this guard the
  // user's scroll position is reset to the bottom mid-stream
  // the moment they tried to read an older message. We track
  // whether the user is currently near the bottom (<=80px gap
  // between the viewport and the document end) via
  // `IntersectionObserver` on the bottom sentinel below. The
  // observer fires the initial state synchronously when we
  // call `.observe(...)`, which mirrors the old `computeNearBottom`
  // immediate-call behaviour. We do NOT use a `scroll` listener
  // — running JS on every scroll frame is jank-prone and
  // re-renders the React tree without batching.
  const nearBottomRef = useRef(true);
  useEffect(() => {
    const sentinel = bottomRef.current;
    if (!sentinel) return;
    // Synchronous initial evaluation mirrors the old
    // `computeNearBottom()` mount-time call. The
    // IntersectionObserver fires its first callback
    // on the next paint, but the auto-scroll
    // useEffect below reads `nearBottomRef.current`
    // during the same commit — running it eagerly
    // here prevents a one-frame yank-back when a
    // user re-enters a thread with stored scroll
    // position.
    const rect = sentinel.getBoundingClientRect();
    nearBottomRef.current = rect.top - window.innerHeight <= 80;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          nearBottomRef.current = entry.isIntersecting;
        }
      },
      { rootMargin: "0px 0px 80px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!threadId) return;
    if (messages.length === 0) return;
    const key = `tutor.lastRead.${threadId}`;
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      return;
    }
    const target = document.querySelector<HTMLElement>(
      `[data-message-id="${stored}"]`
    );
    if (target) {
      target.scrollIntoView({ behavior: "auto", block: "start" });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    window.localStorage.removeItem(key);
  }, [threadId, messages.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!threadId) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      return;
    }
    const key = `tutor.lastRead.${threadId}`;
    if (window.localStorage.getItem(key)) return;
    // Respect the user's scroll position: do not yank them back
    // to the bottom if they have scrolled up to re-read an
    // earlier turn. The thread is still reactive (new chunks
    // extend the document height); they can choose to scroll
    // down again by tapping the composer or using a manual
    // jump-to-bottom affordance.
    if (!nearBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, totalLength, threadId]);

  return (
    <ol
      aria-label="Tutor thread"
      className="flex flex-col gap-5 px-1 pb-3 pt-4 sm:px-2"
    >
      <li aria-hidden className="sr-only">
        <p aria-live="polite" aria-atomic="true">
          {status === "submitted" || status === "streaming"
            ? "Tutor is preparing a response."
            : status === "ready"
              ? "Tutor finished."
              : "Tutor hit an error."}
        </p>
      </li>
      {messages.map((m, messageIdx) => {
        const isLast = messageIdx === messages.length - 1;
        const isStreaming =
          isLast &&
          m.role === "assistant" &&
          (status === "submitted" || status === "streaming");
        const structuredRaw =
          m.role === "assistant" && !isStreaming
            ? (m.metadata as Record<string, unknown> | null)?.structured
            : undefined;
        const isAssistantSettled = typeof structuredRaw === "string";

        return (
          <Fragment key={m.id}>
            <li
              data-message-id={m.id}
              className={cn(
                "flex w-full",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "flex min-w-0 flex-col",
                  m.role === "user"
                    ? "max-w-[88%] items-end"
                    : "max-w-full items-start"
                )}
              >
                <MessageBubble
                  message={m}
                  streaming={isStreaming}
                  onRegenerate={onRegenerate}
                  canRegenerate={canRegenerate}
                  topicId={topicId}
                  practiceHref={practiceHref}
                  hasStructured={isAssistantSettled}
                  structuredJson={isAssistantSettled ? structuredRaw : undefined}
                  onInlinePracticeRequested={onInlinePracticeRequested}
                  onChoicePicked={
                    onChoicePicked
                      ? (signal) => onChoicePicked(m.id, signal)
                      : undefined
                  }
                  subjectId={subjectId}
                  topicTitle={topicTitle}
                />
                {m.role === "assistant" &&
                  inlinePractices
                    .filter((s) => s.anchorMessageId === m.id)
                    .map((s) => (
                      <InlinePractice key={s.id} sessionId={s.id} />
                    ))}
              </div>
            </li>
          </Fragment>
        );
      })}
      <li aria-hidden ref={bottomRef} className="h-px" />
    </ol>
  );
}

function MessageBubble({
  message,
  streaming,
  onRegenerate,
  canRegenerate,
  topicId,
  practiceHref,
  hasStructured,
  structuredJson,
  onInlinePracticeRequested,
  onChoicePicked,
  subjectId,
  topicTitle,
}: {
  readonly message: UIMessage;
  readonly streaming: boolean;
  readonly onRegenerate: (() => void) | undefined;
  readonly canRegenerate: boolean;
  readonly topicId: string | null;
  readonly practiceHref: string | null;
  readonly hasStructured: boolean;
  readonly structuredJson?: string;
  readonly onInlinePracticeRequested?: () => void;
  readonly onChoicePicked?: (signal: {
    readonly responseTimeMs: number;
    readonly pickedCorrect: boolean;
  }) => void;
  readonly subjectId?: string | null;
  readonly topicTitle?: string | null;
}) {
  const isUser = message.role === "user";
  const userText = isUser ? extractText(message) : "";

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div className="min-w-0">
        {isUser ? (
          <div className="rounded-2xl rounded-br-md bg-foreground/10 px-4 py-2.5 text-foreground">
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
              {userText.length > 0 ? userText : ""}
            </p>
          </div>
        ) : (
          <AssistantParts
            parts={message.parts}
            messageId={message.id}
            streaming={streaming}
            hasStructured={hasStructured}
            structuredJson={structuredJson}
            onChoicePicked={onChoicePicked}
          />
        )}
        {!isUser && (
          <MessageActions
            messageText={userText.length > 0 ? userText : extractText(message)}
            topicId={topicId}
            onRegenerate={canRegenerate ? onRegenerate : undefined}
            canRegenerate={canRegenerate}
            practiceHref={practiceHref}
            onInlinePracticeRequested={onInlinePracticeRequested}
            subjectId={subjectId}
            topicTitle={topicTitle}
          />
        )}
      </div>
    </div>
  );
}

function AssistantParts({
  parts,
  messageId,
  streaming,
  hasStructured,
  structuredJson,
  onChoicePicked,
}: {
  readonly parts: UIMessage["parts"];
  readonly messageId: string;
  readonly streaming: boolean;
  readonly hasStructured: boolean;
  readonly structuredJson?: string;
  readonly onChoicePicked?: (signal: {
    readonly responseTimeMs: number;
    readonly pickedCorrect: boolean;
  }) => void;
}) {
  if (hasStructured && !streaming) {
    const rawText = parts
      .filter((p) => isTextUIPart(p))
      .map((p) => (p as { text: string }).text)
      .join("");
    const structuredParsed = tryParseStructured(
      structuredJson ?? rawText
    );
    return (
      <StructuredResponse
        structured={structuredParsed}
        rawText={rawText}
        messageId={messageId}
        onChoicePicked={onChoicePicked}
      />
    );
  }

  return (
    <div data-testid="assistant-parts" className="flex flex-col gap-2">
      {parts.map((part, idx) => {
        if (isReasoningUIPart(part)) {
          return (
            <ReasoningPart
              key={`r-${idx}`}
              text={part.text}
              state={part.state ?? "done"}
            />
          );
        }
        if (isTextUIPart(part)) {
          if (part.text.length > 0) {
            const marker = parseBlockMarker(part.text);
            if (marker !== null) {
              return (
                <BlockWidget
                  key={`w-${idx}`}
                  marker={marker}
                  streaming={streaming}
                  onChoicePicked={onChoicePicked}
                />
              );
            }
          }
          return (
            <div
              key={`t-${idx}`}
              data-testid="assistant-text-part"
              className="min-h-[1em]"
            >
              {part.text.length > 0 ? (
                <AIMarkdown
                  id={`${messageId}-t-${idx}`}
                  content={part.text}
                  density="compact"
                  streaming={streaming}
                />
              ) : null}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

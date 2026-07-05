"use client";

import { useEffect, useMemo, useRef } from "react";
import type { UIMessage } from "@ai-sdk/react";
import {
  isReasoningUIPart,
  isTextUIPart,
} from "ai";
import {
  ChatCircleText,
  Pulse,
  Sparkle,
  User as UserIcon,
} from "@phosphor-icons/react/dist/ssr";

import {
  cn,
} from "@/lib/utils/cn";
import { extractText } from "@/lib/ai/uiMessage";
import { AIMarkdown } from "@/lib/content/aiMarkdown";
import { parseBlockMarker, BlockWidget } from "@/lib/content/tutorWidgets";
import { ReasoningPart } from "./ReasoningPart";
import { SuggestionDock } from "./SuggestionDock";
import { MessageActions } from "./MessageActions";
import { StreamingIndicator } from "./StreamingIndicator";

/**
 * MessageList.
 *
 * The chat surface for the AI Copilot. Renders the
 * tutor thread with rich per-message chrome:
 *
 *   - Study timeline timestamp column on the LEFT
 *     (similar to Notion's history view: the user
 *     always knows the message hour).
 *   - User messages right-aligned with a compact
 *     bubble; assistant messages left-aligned with
 *     a wider bubble.
 *   - Per-message action toolbar (Helpful, Re-roll,
 *     Flashcards, Note, Practice, Copy, Share) on
 *     hover/always-visible on touch.
 *   - Six pre-built suggestion chips (SuggestionDock)
 *     under each *settled* assistant message.
 *   - Block widgets (Floating card, Reveal step,
 *     Choice menu, Diagram) for `[[…]]` markers
 *     emitted by the model.
 *
 * Streaming state: when `status` is "submitted" the
 * list shows a quiet placeholder chip + a four-stage
 * indicator. When the status is "streaming" the
 * assistant message animates content in via the
 * existing AIMarkdown + KaTeX pipeline.
 *
 * The widget parser (`parseBlockMarker`) is invoked
 * per-part on every text part of the assistant
 * message — a single-line block becomes a single
 * widget, multi-paragraph blocks are still parsed
 * markdown. Streaming safety: while a marker is open
 * (`[[steps:…` but no `]]` yet) the widget renders
 * a Pulse skeleton rather than the raw markdown.
 */
export function MessageList({
  messages,
  status,
  topicTitle,
  onPickSuggestion,
  onRegenerate,
  topicId,
}: {
  readonly messages: readonly UIMessage[];
  readonly status: "submitted" | "streaming" | "ready" | "error";
  readonly topicTitle: string | null;
  readonly onPickSuggestion: (text: string) => void;
  /**
   * Re-issues the most recent assistant message.
   * The parent passes it as undefined during the
   * stream (and on the very first user turn before
   * any assistant reply), per the AI SDK UI docs
   * "Cancellation and regeneration".
   */
  readonly onRegenerate: (() => void) | undefined;
  readonly topicId: string | null;
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, totalLength]);

  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <ol
      aria-label="Tutor thread"
      className="flex flex-col gap-3 px-1 pb-3 pt-4 sm:px-2"
    >
      {messages.map((m, messageIdx) => {
        const ts = messageTimestamp(m);
        const isLast = messageIdx === messages.length - 1;
        // Per-message streaming flag. Only the last
        // *assistant* message is "currently streaming";
        // everything else is settled and falls back to
        // the user-controlled reveal pattern in StepReveal
        // and the standard markdown render in AIMarkdown.
        const isStreaming =
          isLast &&
          m.role === "assistant" &&
          (status === "submitted" || status === "streaming");
        return (
          <li
            key={m.id}
            className={cn(
              "group/row flex w-full gap-3",
              m.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <TimelineColumn ts={ts} />
            <div
              className={cn(
                "flex min-w-0 flex-col",
                m.role === "user" ? "items-end max-w-[88%]" : "items-start max-w-[88%]"
              )}
            >
              <MessageBubble
                message={m}
                streaming={isStreaming}
                onPickSuggestion={onPickSuggestion}
                onRegenerate={onRegenerate}
                canRegenerate={canRegenerate}
                topicId={topicId}
              />
              {m.role === "assistant" && isLast && (
                <StreamingIndicator status={status} />
              )}
              {m.role === "assistant" && !isLast && (
                <SuggestionDock
                  topicTitle={topicTitle}
                  onPick={onPickSuggestion}
                  isStreaming={status === "submitted" || status === "streaming"}
                />
              )}
              {m.role === "assistant" && isLast && status === "ready" && (
                <SuggestionDock
                  topicTitle={topicTitle}
                  onPick={onPickSuggestion}
                  isStreaming={false}
                />
              )}
            </div>
          </li>
        );
      })}
      <li aria-hidden ref={bottomRef} className="h-px" />
    </ol>
  );
}

/**
 * TimelineColumn.
 *
 * Left-side timestamp column on every message. The
 * hour:minute format is dense enough for a glance
 * without sacrificing precision.
 *
 * SSR-safe: `messageTimestamp` derives from the
 * Convex `_creationTime` already on every message;
 * for messages that have no creation time (AI SDK
 * streams) we fall back to the local clock.
 */
function TimelineColumn({ ts }: { readonly ts: number }) {
  return (
    <div
      aria-hidden={false}
      aria-label={new Date(ts).toLocaleString()}
      className="mt-1 hidden shrink-0 select-none flex-col items-end gap-0.5 md:flex"
    >
      <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/70">
        {formatHourMinute(ts)}
      </span>
      <span className="h-1.5 w-1.5 rounded-full bg-border" />
    </div>
  );
}

function formatHourMinute(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * messageTimestamp.
 *
 * Reads the message's `_creationTime` from the UIMessage
 * id if available; otherwise falls back to Date.now().
 * The id format from the AI SDK does not encode a time
 * stamp reliably so we lean on the source rows where
 * possible.
 */
function messageTimestamp(m: UIMessage): number {
  // Best-effort: AI SDK UIMessages carry a string id
  // we cannot parse for a millisecond epoch. We pull
  // a denormalized `createdAt` if the parent passes
  // one via metadata; otherwise we read Date.now().
  const meta = m.metadata as { createdAt?: number } | undefined;
  if (meta?.createdAt && Number.isFinite(meta.createdAt)) {
    return meta.createdAt;
  }
  return Date.now();
}

/**
 * EmptyState.
 *
 * Quiet landing for an empty thread. The visual
 * reads as "your AI is ready" rather than "oh no,
 * something is broken" — important for a fresh
 * first-time user.
 */
function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle/60 text-accent" aria-hidden>
        <Sparkle className="h-5 w-5" weight="duotone" />
      </span>
      <p className="text-[13.5px] font-medium text-foreground">
        Ready when you are
      </p>
      <p className="max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
        Drop a question below and the tutor will ground its answer in your
        mastery, recent mistakes, and the topic&apos;s objectives.
      </p>
    </div>
  );
}

/**
 * MessageBubble.
 *
 * Per-message renderer. Assistant messages get the
 * rich timeline bubble (with widget parser on each
 * text part + ReasoningPartition when reasoning is
 * present); user messages get a simpler right-aligned
 * bubble.
 *
 * The user's text is plain (whitespace-preserved,
 * no markdown rendering) because shaping the user's
 * own text would distort their intent. The Assistant
 * text goes through AIMarkdown so it gets KaTeX +
 * sanitization + block-level memoization.
 */
function MessageBubble({
  message,
  streaming,
  onPickSuggestion,
  onRegenerate,
  canRegenerate,
  topicId,
}: {
  readonly message: UIMessage;
  /**
   * Threads the chat-status `streaming` flag into
   * the assistant text render. `true` for the last
   * assistant message while useChat is submitted or
   * streaming; `false` for everything else (user
   * messages, older assistant messages, and the
   * post-stream settled state).
   */
  readonly streaming: boolean;
  readonly onPickSuggestion: (text: string) => void;
  readonly onRegenerate: (() => void) | undefined;
  readonly canRegenerate: boolean;
  readonly topicId: string | null;
}) {
  const isUser = message.role === "user";
  const userText = isUser ? extractText(message) : "";

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
          "max-w-full rounded-2xl px-4 py-2.5",
          isUser
            ? "rounded-br-md bg-accent text-accent-foreground"
            : "rounded-bl-md border border-border bg-surface-elevated text-foreground shadow-[var(--shadow-soft)]"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
            {userText.length > 0 ? userText : ""}
          </p>
        ) : (
          <AssistantParts
            parts={message.parts}
            messageId={message.id}
            streaming={streaming}
            onPickSuggestion={onPickSuggestion}
          />
        )}
      </div>
      {!isUser && (
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-muted-foreground"
          aria-hidden
        >
          <ChatCircleText className="h-3.5 w-3.5" weight="duotone" />
        </span>
      )}
      {isUser && (
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
          aria-hidden
        >
          <UserIcon className="h-3.5 w-3.5" weight="duotone" />
        </span>
      )}
      {!isUser && (
        <MessageActions
          messageText={extractText(message)}
          topicId={topicId}
          onRegenerate={canRegenerate ? onRegenerate : undefined}
          canRegenerate={canRegenerate}
        />
      )}
    </div>
  );
}

/**
 * AssistantParts.
 *
 * Renders the per-part stream of an assistant
 * UIMessage. The widget parser runs on EACH text
 * part so a `[[steps:...]]` block becomes an
 * interactive `StepReveal` rather than raw text.
 * 
 * Streaming edge: incomplete markers render a
 * Pulse skeleton via `BlockWidget({ marker: { kind:
 * "incomplete" } })` so the user sees the widget
 * shaping up while tokens arrive.
 */
function AssistantParts({
  parts,
  messageId,
  streaming,
  onPickSuggestion,
}: {
  readonly parts: UIMessage["parts"];
  readonly messageId: string;
  /**
   * Whether this assistant message is currently
   * being streamed. Forwarded into `<AIMarkdown>`
   * and `<BlockWidget>` so stream-sensitive widgets
   * (`StepReveal`) can auto-emerge progressively
   * instead of waiting for the user's manual reveal.
   */
  readonly streaming: boolean;
  readonly onPickSuggestion: (text: string) => void;
}) {
  if (parts.length === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[13.5px] text-muted-foreground"
        aria-label="Tutor is preparing a response"
      >
        <Pulse
          aria-hidden
          className="h-3.5 w-3.5 animate-pulse text-accent"
          weight="duotone"
        />
        ...
      </span>
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
          // For each text part, attempt to parse as a
          // single-block widget marker. The parser is
          // strict about the marker being the WHOLE
          // block — multi-paragraph markdown stays
          // markdown.
          if (part.text.length > 0) {
            const marker = parseBlockMarker(part.text);
            if (marker !== null) {
              return (
                <BlockWidget
                  key={`w-${idx}`}
                  marker={marker}
                  streaming={streaming}
                  onAskQuestion={onPickSuggestion}
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

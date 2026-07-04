"use client";

import { useEffect, useRef } from "react";
import type { ChatStatus } from "ai";

import { ArrowUp, PaperPlaneTilt } from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";

/**
 * MessageInput.
 *
 * A controlled form that submits to the tutor. The actual
 * useChat hook lives in `TutorClient` so the live streaming
 * message can flow into `MessageList` (otherwise the stream
 * would be hidden inside this form's instance of useChat).
 *
 * Enter sends, Shift+Enter inserts a newline. The send
 * button morphs into a stop button while the tutor is
 * thinking or streaming.
 */
export function MessageInput({
  input,
  setInput,
  onSubmit,
  status,
  onStop,
  error,
}: {
  readonly input: string;
  readonly setInput: (next: string) => void;
  readonly onSubmit: (text: string) => void;
  readonly status: ChatStatus;
  readonly onStop: () => void;
  readonly error: Error | undefined;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = status === "submitted" || status === "streaming";
  const canSend = input.trim().length > 0;

  // Refocus the textarea whenever the stream ends so the
  // user can type the next question without clicking.
  useEffect(() => {
    if (status === "ready") {
      textareaRef.current?.focus();
    }
  }, [status]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSend) return;
    onSubmit(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!canSend || isStreaming) return;
      onSubmit(input);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-subject-french/30 bg-subject-french/10 px-3 py-2 text-[12px] text-subject-french"
        >
          The tutor could not respond. {error.message || "Try again in a moment."}
        </div>
      )}
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface-elevated p-2 shadow-[var(--shadow-soft)]">
        <label htmlFor="tutor-input" className="sr-only">
          Message the tutor
        </label>
        <textarea
          id="tutor-input"
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder={
            isStreaming
              ? "The tutor is still answering. Queue your next question."
              : "Ask a question. Enter to send, Shift+Enter for newline."
          }
          className={cn(
            "min-h-[2.5rem] flex-1 resize-none rounded-xl border-0 bg-transparent px-3 py-2 text-[13.5px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
          )}
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition-all hover:opacity-90 active:scale-[0.97]"
          >
            <span className="block h-3 w-3 rounded-sm bg-background" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-all hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {canSend ? (
              <PaperPlaneTilt className="h-4 w-4" weight="fill" />
            ) : (
              <ArrowUp className="h-4 w-4" weight="bold" />
            )}
          </button>
        )}
      </div>
    </form>
  );
}

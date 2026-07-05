"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatStatus } from "ai";
import {
  ArrowUp,
  Camera,
  Cards,
  Function as FunctionIcon,
  GraduationCap,
  Microphone,
  PaperPlaneTilt,
  Plus,
  X,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils/cn";

/**
 * Composer.
 *
 * The redesigned command-center message input that
 * sits at the bottom of /tutor. Replaces the
 * previous `MessageInput`. Three concerns:
 *
 *   1. Multi-line textarea (auto-grow by row count,
 *      capped at 6 rows visible before scrolling).
 *   2. Action chips left of the input: Insert math
 *      (equation inserter modal), Make flashcards,
 *      Start practice, Speak (placeholder), Scan
 *      homework (placeholder). Some chips route to
 *      a focused helper; others are wired into a
 *      structured prompt that the AI interprets.
 *   3. Send / stop toggle on the right. Same
 *      directive as the previous version (Enter =
 *      send, Shift+Enter = newline).
 *
 * Exposes an imperative `insertText` API via ref so
 * the parent shell can pre-fill from the suggestion
 * dock or any other surface.
 *
 * (The original `useImperativeHandle` + `ComposerHandle`
 * export are retained as a doc comment; the parent shell
 * currently drives the composer via React state. The
 * imperative ref is reserved for the next iteration that
 * wants the suggestion dock to write into the textarea
 * directly without lifting state up.)
 */
// export interface ComposerHandle {
//   insertText: (text: string) => void;
//   focus: () => void;
// }

export function Composer({
  input,
  setInput,
  onSubmit,
  status,
  onStop,
  error,
  onRegenerate,
  onPracticeRequested,
  onFlashcardsRequested,
  fallbackLessonHref,
}: {
  readonly input: string;
  readonly setInput: (
    next: string | ((prev: string) => string)
  ) => void;
  readonly onSubmit: (text: string) => void;
  readonly status: ChatStatus;
  readonly onStop: () => void;
  readonly error: Error | undefined;
  readonly onRegenerate?: () => void;
  readonly onPracticeRequested?: () => void;
  readonly onFlashcardsRequested?: () => void;
  /**
   * Where `Open practice` navigates. The page-level
   * owner (TutorClient → server page) supplies this
   * because the canonical practice URL differs for
   * canonical vs. user-owned topics.
   */
  readonly fallbackLessonHref: string | null;
}) {
  const [equationOpen, setEquationOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = status === "submitted" || status === "streaming";
  const canSend = input.trim().length > 0;
  const canRegenerate = Boolean(onRegenerate) && (status === "ready" || status === "error");

  // Re-focus the textarea when the stream ends so the
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

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setInput((prev) => `${prev}${text}`);
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const next = ta.value.slice(0, start) + text + ta.value.slice(end);
    setInput(next);
    // Restore cursor after the inserted snippet.
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-1.5"
    >
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-subject-french/30 bg-subject-french/10 px-3 py-2 text-[12px] text-subject-french"
        >
          <span>Something went wrong.</span>
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={!canRegenerate}
              className="inline-flex h-7 shrink-0 items-center rounded-md border border-subject-french/40 bg-subject-french/10 px-2.5 text-[11.5px] font-medium text-subject-french transition-colors hover:bg-subject-french/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Retry
            </button>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-elevated p-2 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center gap-1 px-1.5 pt-1">
          <ActionChip
            icon={<FunctionIcon className="h-3.5 w-3.5" weight="duotone" />}
            label="Equation"
            onClick={() => setEquationOpen(true)}
            tone="accent"
          />
          <ActionChip
            icon={<Cards className="h-3.5 w-3.5" weight="duotone" />}
            label="Flashcards"
            onClick={onFlashcardsRequested ?? (() => {
              insertAtCursor("\n[Generate flashcards on what we just discussed. 6 cards, front=term, back=definition.]\n");
            })}
            tone="muted"
          />
          <ActionChip
            icon={<GraduationCap className="h-3.5 w-3.5" weight="duotone" />}
            label="Practice"
            onClick={onPracticeRequested ?? (() => {
              if (fallbackLessonHref) {
                window.open(fallbackLessonHref, "_blank", "noopener,noreferrer");
              }
            })}
            tone="muted"
          />
          <ActionChip
            icon={<Microphone className="h-3.5 w-3.5" weight="duotone" />}
            label="Speak"
            onClick={() => insertAtCursor("[Voice reply coming soon. Type your question for now.]")}
            tone="muted"
            disabled
          />
          <ActionChip
            icon={<Camera className="h-3.5 w-3.5" weight="duotone" />}
            label="Scan"
            onClick={() => insertAtCursor("[Scan homework coming soon. Send the question as text for now.]")}
            tone="muted"
            disabled
          />
        </div>
        <div className="flex items-end gap-2 px-1.5 pb-1">
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
                ? "The tutor is finishing. Queue your next question."
                : "Ask a question. Enter to send, Shift+Enter for newline."
            }
            className="min-h-[2.5rem] flex-1 resize-none rounded-xl border-0 bg-transparent px-2 py-2 text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
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
              className={cn(
                "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50",
                canSend ? "bg-accent text-accent-foreground hover:opacity-90" : "bg-surface-elevated text-muted-foreground"
              )}
            >
              {canSend ? (
                <PaperPlaneTilt className="h-4 w-4" weight="fill" />
              ) : (
                <ArrowUp className="h-4 w-4" weight="bold" />
              )}
            </button>
          )}
        </div>
        <p className="flex items-center justify-between px-1.5 pb-1 text-[10.5px] text-muted-foreground">
          <span>
            The tutor reads from your mastery, recent mistakes and topic
            objectives.
          </span>
          <span className="font-mono uppercase tracking-[0.16em]">
            Enter ↵ · Shift+Enter ⇧ ↵
          </span>
        </p>
      </div>

      {equationOpen ? (
        <EquationInserter
          onInsert={(latex) => {
            insertAtCursor(`\\(${latex}\\)`);
            setEquationOpen(false);
          }}
          onClose={() => setEquationOpen(false)}
        />
      ) : null}
    </form>
  );
}

/**
 * ActionChip.
 *
 * Pill button used in the row above the textarea.
 * Tone determines color treatment.
 */
function ActionChip({
  icon,
  label,
  onClick,
  tone,
  disabled = false,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
  readonly tone?: "muted" | "accent";
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        tone === "accent"
          ? "bg-accent-subtle/60 text-accent hover:bg-accent-subtle"
          : "bg-surface-elevated/50 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/**
 * EquationInserter.
 *
 * Modal-style form that lets the user type LaTeX
 * and insert it inline as `\(…\)`. Persists the
 * last text via a local ref so accidental close
 * doesn't wipe the draft.
 *
 * The math pipeline is the SAME one AIMarkdown uses
 * (KaTeX + sanitization), so any LaTeX the user
 * inserts here renders identically in the reply.
 */
function EquationInserter({
  onInsert,
  onClose,
}: {
  readonly onInsert: (latex: string) => void;
  readonly onClose: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div
      className="mt-2 flex flex-col gap-2 rounded-xl border border-border bg-background p-3"
      role="dialog"
      aria-label="Insert equation"
    >
      <header className="flex items-center justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          Insert LaTeX
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close equation inserter"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
        >
          <X className="h-3 w-3" weight="bold" />
        </button>
      </header>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="e.g. x^2 + 2x + 1"
        className="w-full resize-none rounded-lg border border-border bg-surface-elevated px-3 py-2 font-mono text-[13px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 items-center rounded-md px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onInsert(value.trim())}
          disabled={value.trim().length === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-medium text-accent-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-3 w-3" weight="bold" />
          Insert into message
        </button>
      </div>
    </div>
  );
}

"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ChatStatus } from "ai";
import {
  ArrowSquareOut,
  ArrowUp,
  Cards,
  Function as FunctionIcon,
  GraduationCap,
  Keyboard,
  Lightning,
  ListChecks,
  PaperPlaneTilt,
  Sparkle,
  Stop,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils/cn";
import { resolveColorVar } from "@/lib/utils/subjectColor";

type SubjectContext = {
  readonly title: string;
  readonly slug: string;
  readonly color?: string;
};

type TopicContext = {
  readonly slug: string;
  readonly title: string;
};

export type ComposerProps = {
  readonly input: string;
  readonly setInput: (next: string | ((prev: string) => string)) => void;
  readonly onSubmit: (text: string) => void;
  readonly status: ChatStatus;
  readonly onStop: () => void;
  readonly error: Error | undefined;
  readonly onRegenerate?: () => void;
  readonly onInlinePracticeRequested?: () => void;
  readonly inlinePracticeRequesting: boolean;
  readonly onSummarizeRequested?: () => void;
  readonly fallbackLessonHref: string | null;
  readonly subject?: SubjectContext | null;
  readonly topic?: TopicContext | null;
  readonly hasMessages: boolean;
};

const SUBJECT_CHIP_COLLAPSE_AT = 24;

const buildSuggestionPrompts = (
  topicTitle: string | null
): ReadonlyArray<string> =>
  topicTitle
    ? [
        `Explain ${topicTitle} as if I had never seen it.`,
        `Quiz me on what we covered in ${topicTitle}.`,
        "Give me a worked example.",
        "What are the common mistakes here?",
      ]
    : [
        "Explain the concept as if I had never seen it.",
        "Quiz me on the topic.",
        "Give me a worked example.",
        "What are the common mistakes here?",
      ];

/**
 * Composer.
 *
 * The bottom-docked text input + always-on tool tray
 * for the /tutor chat surface. One single-layer card;
 * tools live as small icon buttons inside the card
 * (not behind a Plus popover), the keyboard hint sits
 * inline with them on the right, and live state
 * (thinking / interrupted) lives in a status row above
 * the card rather than as a separate error banner.
 *
 * The context strip on the left of the textarea fades
 * to a 0-width pill once the user has written enough;
 * the chip's space collapses so longer messages have
 * the room they need without losing context.
 *
 * The streaming halo inside the card is a soft accent
 * wash that breathes (2.4s opacity pulse) while the
 * AI is responding. It is a real status signal, not
 * decoration: when the stream settles, it fades to
 * zero in 300ms.
 *
 * Empty-state starter chips render below the card on
 * a fresh /tutor load, fade out as soon as the user
 * starts typing or the first exchange lands, and click
 * → fill the input rather than auto-submit so the
 * user reviews the prompt first.
 *
 * All motion respects `prefers-reduced-motion`. The
 * reduced path collapses to opacity-only fades with no
 * spring or scale changes.
 */
export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(
  function Composer(props, forwardedRef) {
    const {
      input,
      setInput,
      onSubmit,
      status,
      onStop,
      error,
      onRegenerate,
      onInlinePracticeRequested,
      inlinePracticeRequesting,
      onSummarizeRequested,
      fallbackLessonHref,
      subject,
      topic,
      hasMessages,
    } = props;

    const formRef = useRef<HTMLFormElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(forwardedRef, () => textareaRef.current!, []);

    const reduceMotion = useReducedMotion() ?? false;
    const isStreaming = status === "submitted" || status === "streaming";
    const canSend = input.trim().length > 0;
    const canRegenerate =
      Boolean(onRegenerate) && (status === "ready" || status === "error");

    const showSubjectChip =
      Boolean(subject) && input.length <= SUBJECT_CHIP_COLLAPSE_AT;
    const showSuggestions =
      !hasMessages &&
      input.trim().length === 0 &&
      !isStreaming &&
      !error &&
      status === "ready";

    useEffect(() => {
      if (status === "ready") {
        textareaRef.current?.focus();
      }
    }, [status]);

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
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + text.length;
        ta.setSelectionRange(pos, pos);
      });
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSend || isStreaming) return;
      onSubmit(input);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!canSend || isStreaming) return;
        onSubmit(input);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!canSend || isStreaming) return;
        onSubmit(input);
      }
    };

    const handleSuggestionClick = (prompt: string) => {
      setInput(prompt);
      requestAnimationFrame(() => textareaRef.current?.focus());
    };

    type Tool = {
      readonly key: string;
      readonly label: string;
      readonly icon: React.ReactNode;
      readonly run: () => void;
      readonly disabled?: boolean;
      readonly active?: boolean;
    };

    const placeholder = isStreaming
      ? "Queue your next question while the tutor finishes."
      : subject
        ? `Ask anything about ${subject.title}…`
        : "Ask a question.";

    const tools: ReadonlyArray<Tool> = [
      {
        key: "equation",
        label: "Insert equation",
        icon: <FunctionIcon className="h-3.5 w-3.5" weight="duotone" />,
        run: () => insertAtCursor("\n\\[your expression here\\]\n"),
      },
      {
        key: "flashcards",
        label: "Generate flashcards",
        icon: <Cards className="h-3.5 w-3.5" weight="duotone" />,
        run: () =>
          insertAtCursor(
            "\n[Generate flashcards on what we just discussed. 6 cards, front=term, back=definition.]\n"
          ),
      },
      {
        key: "practice",
        label: "Open practice set",
        icon: <GraduationCap className="h-3.5 w-3.5" weight="duotone" />,
        run: () => {
          if (fallbackLessonHref && typeof window !== "undefined") {
            window.open(fallbackLessonHref, "_blank", "noopener,noreferrer");
          }
        },
      },
      {
        key: "summarize",
        label: "Summarize thread",
        icon: <ListChecks className="h-3.5 w-3.5" weight="duotone" />,
        run: () => {
          if (onSummarizeRequested) {
            onSummarizeRequested();
            return;
          }
          insertAtCursor(
            "\nSummarize the key concepts we covered in this thread so far, in 3-4 sentences.\n"
          );
        },
      },
      ...(onInlinePracticeRequested
        ? [
            {
              key: "inline",
              label: inlinePracticeRequesting
                ? "Generating practice…"
                : "Generate quick practice",
              icon: (
                <Lightning
                  className={cn(
                    "h-3.5 w-3.5",
                    inlinePracticeRequesting && "animate-pulse motion-reduce:animate-none"
                  )}
                  weight="duotone"
                />
              ),
              run: () => onInlinePracticeRequested(),
              disabled: inlinePracticeRequesting,
            } satisfies Tool,
          ]
        : []),
    ];

    const iconMorph = reduceMotion
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.1 },
        }
      : ({
          initial: { opacity: 0, scale: 0.7, rotate: -22 },
          animate: { opacity: 1, scale: 1, rotate: 0 },
          exit: { opacity: 0, scale: 0.7, rotate: 22 },
          transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] as const },
        } as const);

    const streamingHaloMotion = reduceMotion
      ? ({
          animate: { opacity: isStreaming ? 0.32 : 0 },
          transition: { duration: 0.2 },
        } as const)
      : ({
          animate: isStreaming
            ? { opacity: [0.15, 0.4, 0.15] }
            : { opacity: 0 },
          transition: isStreaming
            ? { duration: 2.4, ease: "easeInOut" as const, repeat: Infinity }
            : { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
        } as const);

    const chipMotion = reduceMotion
      ? ({
          initial: false,
          animate: {
            opacity: showSubjectChip ? 1 : 0,
            width: showSubjectChip ? "auto" : 0,
            marginRight: showSubjectChip ? 0 : -8,
          },
          transition: { duration: 0.18 },
        } as const)
      : ({
          initial: false,
          animate: {
            opacity: showSubjectChip ? 1 : 0,
            scale: showSubjectChip ? 1 : 0.92,
            width: showSubjectChip ? "auto" : 0,
            marginRight: showSubjectChip ? 0 : -8,
          },
          transition: {
            type: "spring",
            stiffness: 480,
            damping: 32,
          },
        } as const);

    const statusPresence = reduceMotion
      ? ({
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.14 },
        } as const)
      : ({
          initial: { opacity: 0, y: -4, scale: 0.98 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: -4, scale: 0.98 },
          transition: {
            type: "spring",
            stiffness: 520,
            damping: 36,
          },
        } as const);

    const suggestionsContainerMotion = reduceMotion
      ? ({
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.18 },
        } as const)
      : ({
          initial: { opacity: 0, y: 6 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: 4 },
          transition: {
            type: "spring",
            stiffness: 420,
            damping: 32,
          },
        } as const);

    const suggestionItemMotion = (index: number) =>
      reduceMotion
        ? {
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.14, delay: 0 },
          }
        : {
            initial: { opacity: 0, y: 6 },
            animate: { opacity: 1, y: 0 },
            transition: {
              duration: 0.32,
              delay: 0.04 * index,
              ease: [0.16, 1, 0.3, 1] as const,
            },
          };

    const sendHoverEnabled = (canSend || isStreaming) && !reduceMotion;

    return (
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="flex flex-col gap-1.5"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {isStreaming ? (
            <motion.div key="streaming" {...statusPresence}>
              <div
                role="status"
                aria-live="polite"
                className="flex items-center justify-between gap-3 rounded-md border border-accent-border/50 bg-accent-subtle/40 px-3 py-2 text-[12px] text-foreground"
              >
                <span className="flex items-center gap-2">
                  <Sparkle
                    aria-hidden
                    className="h-3 w-3 animate-pulse text-accent motion-reduce:animate-none"
                    weight="fill"
                  />
                  <span>The tutor is preparing a response.</span>
                </span>
              </div>
            </motion.div>
          ) : error ? (
            <motion.div key="error" {...statusPresence}>
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-md border border-subject-french/40 bg-subject-french/10 px-3 py-2 text-[12px] text-foreground"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-subject-french"
                  />
                  <span>Response interrupted.</span>
                </span>
                {onRegenerate ? (
                  <button
                    type="button"
                    onClick={onRegenerate}
                    disabled={!canRegenerate}
                    className="inline-flex h-7 shrink-0 items-center rounded-md border border-border bg-background px-2.5 text-[11.5px] font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div
          data-composer-root
          aria-busy={isStreaming}
          className={cn(
            "group/composer relative isolate rounded-[22px] border border-border bg-surface-elevated p-2 transition-[border-color,box-shadow] duration-300 ease-[var(--ease-smooth)] focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground/40 shadow-[var(--shadow-soft)]"
          )}
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit]"
            style={{ background: "var(--accent-subtle)" }}
            {...streamingHaloMotion}
          />

          <div className="relative flex items-end gap-2">
            <motion.div
              aria-hidden={!showSubjectChip}
              className="flex shrink-0 items-center overflow-hidden"
              style={{ pointerEvents: showSubjectChip ? "auto" : "none" }}
              {...chipMotion}
            >
              {subject ? (
                <span
                  aria-label={`Subject context: ${subject.title}`}
                  className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-border/70 bg-surface-elevated/80 py-0 pl-1.5 pr-2.5 text-[11.5px] font-medium text-foreground transition-colors duration-150 ease-[var(--ease-smooth)] group-hover/composer:border-foreground/40"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: resolveColorVar(subject.color) ?? "var(--accent)",
                    }}
                  />
                  <span className="max-w-[140px] truncate">{subject.title}</span>
                </span>
              ) : null}
            </motion.div>

            <label htmlFor="tutor-input" className="sr-only">
              Message the tutor
            </label>
            <div className="flex min-w-0 flex-1 flex-col">
              <textarea
                id="tutor-input"
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={placeholder}
                className="composer-textarea min-h-[2.25rem] w-full resize-none border-0 bg-transparent px-2 py-1.5 text-[14px] leading-[1.55] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
              />
            </div>

            <motion.button
              type={isStreaming ? "button" : "submit"}
              onClick={isStreaming ? onStop : undefined}
              disabled={!isStreaming && !canSend}
              aria-label={isStreaming ? "Stop generating" : canSend ? "Send message" : "Empty message"}
              title={isStreaming ? "Stop" : "Send"}
              whileHover={sendHoverEnabled ? { y: -1 } : undefined}
              whileTap={sendHoverEnabled ? { y: 0 } : undefined}
              transition={
                reduceMotion
                  ? { duration: 0.1 }
                  : { type: "spring", stiffness: 380, damping: 26 }
              }
              className={cn(
                "relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full transition-colors duration-200 ease-[var(--ease-smooth)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 disabled:cursor-not-allowed",
                isStreaming
                  ? "bg-foreground text-background shadow-[var(--shadow-soft)]"
                  : canSend
                    ? "bg-accent text-accent-foreground shadow-[0_4px_18px_-6px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
                    : "bg-surface text-muted-foreground"
              )}
            >
              <AnimatePresence initial={false} mode="popLayout">
                {isStreaming ? (
                  <motion.span
                    key="stop"
                    {...iconMorph}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Stop className="h-3.5 w-3.5" weight="fill" />
                  </motion.span>
                ) : canSend ? (
                  <motion.span
                    key="send"
                    {...iconMorph}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <PaperPlaneTilt className="h-3.5 w-3.5" weight="fill" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    {...iconMorph}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <ArrowUp className="h-3.5 w-3.5" weight="bold" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          <div className="relative mt-0.5 flex flex-wrap items-center gap-0.5 px-1">
            {tools.map((tool) => (
              <button
                key={tool.key}
                type="button"
                onClick={tool.run}
                aria-label={tool.label}
                title={tool.label}
                disabled={tool.disabled ?? false}
                className={cn(
                  "group/tool inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-[var(--ease-smooth)] hover:bg-accent-subtle/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 disabled:cursor-not-allowed disabled:opacity-50",
                  tool.active && "bg-accent-subtle/60 text-accent"
                )}
              >
                <span aria-hidden className="relative inline-flex">
                  {tool.icon}
                  {tool.key === "practice" ? (
                    <ArrowSquareOut
                      aria-hidden
                      className="pointer-events-none absolute -right-0.5 -top-0.5 h-2 w-2 text-muted-foreground/70"
                      weight="bold"
                    />
                  ) : null}
                </span>
              </button>
            ))}

            <div className="ml-auto hidden items-center gap-1.5 text-[10.5px] leading-none text-muted-foreground/80 sm:flex">
              <span className="inline-flex items-center gap-1">
                <Keyboard className="h-3 w-3" weight="duotone" />
                <span className="font-mono text-[10px]">Enter</span>
                <span>send</span>
              </span>
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="font-mono text-[10px]">Shift</span>
                <span aria-hidden>+</span>
                <span className="font-mono text-[10px]">Enter</span>
                <span>newline</span>
              </span>
            </div>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {showSuggestions ? (
            <motion.div
              key="suggestions"
              {...suggestionsContainerMotion}
              className="flex flex-wrap items-center gap-1.5 px-1"
            >
              {buildSuggestionPrompts(topic?.title ?? null).map(
                (prompt, index) => (
                  <motion.button
                    key={prompt}
                    type="button"
                    onClick={() => handleSuggestionClick(prompt)}
                    {...suggestionItemMotion(index)}
                    className="inline-flex h-7 items-center rounded-md border border-border bg-surface px-2.5 text-[11.5px] font-medium text-foreground transition-colors duration-150 ease-[var(--ease-smooth)] hover:border-foreground/40 hover:bg-surface-elevated"
                  >
                    {prompt}
                  </motion.button>
                )
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </form>
    );
  }
);

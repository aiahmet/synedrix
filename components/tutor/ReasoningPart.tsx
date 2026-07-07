"use client";

import { Fragment, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import { Brain, CaretDown, Sparkle } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils/cn";
const AUTO_COLLAPSE_THRESHOLD = 280;
function deriveInitialOpen(
  text: string,
  state: "streaming" | "done"
): boolean {
  if (state === "streaming") return true;
  return text.length <= AUTO_COLLAPSE_THRESHOLD;
}

export interface ReasoningPartProps {
  readonly text: string;
  readonly state: "streaming" | "done";
}

export function ReasoningPart({
  text,
  state,
}: ReasoningPartProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(() =>
    deriveInitialOpen(text, state)
  );

  const isLive = state === "streaming";
  const isDone = state === "done";
  const isPending = text.length === 0 && isLive;

  return (
    <Fragment>
      <div
        data-state={state}
        role="group"
        aria-label="Model reasoning"
        className={cn(
          "my-2 overflow-hidden rounded-lg border",
          "border-accent-border/50 bg-accent-subtle/40",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          "transition-colors duration-200"
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="reasoning-content"
          data-testid="reasoning-toggle"
          className={cn(
            "group flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left",
            "outline-none transition-colors duration-200",
            "hover:bg-accent-subtle/70",
            "focus-visible:bg-accent-subtle/70",
            "focus-visible:border focus-visible:border-foreground",
            "focus-visible:ring-1 focus-visible:ring-foreground/40"
          )}
        >
          {}
          <span
            className="relative flex h-4 w-4 shrink-0 items-center justify-center"
            aria-hidden
          >
            <Brain
              className="h-3.5 w-3.5 text-accent"
              weight="duotone"
            />
            {isLive && !reduce && (
              <motion.span
                className="absolute inset-0 rounded-full border border-accent/40"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 1.55, opacity: 0 }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
            )}
          </span>

          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
            Reasoning
          </span>

          {}
          {isLive ? (
            <span
              data-testid="reasoning-status-live"
              className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/70"
            >
              <motion.span
                aria-hidden
                animate={reduce ? undefined : { opacity: [0.45, 1, 0.45] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="inline-block"
              >
                live
              </motion.span>
            </span>
          ) : isDone ? (
            <span
              data-testid="reasoning-status-done"
              className="inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/70"
            >
              <Sparkle className="h-2.5 w-2.5 text-accent/70" weight="fill" />
              finished
            </span>
          ) : null}

          <span className="flex-1" />

          <motion.span
            aria-hidden
            animate={
              reduce
                ? undefined
                : { rotate: open ? 0 : -90, opacity: 1 }
            }
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-muted-foreground/70"
          >
            <CaretDown className="h-3 w-3" weight="bold" />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id="reasoning-content"
              key="content"
              initial={
                reduce
                  ? { opacity: 0 }
                  : { height: 0, opacity: 0 }
              }
              animate={
                reduce
                  ? { opacity: 1 }
                  : { height: "auto", opacity: 1 }
              }
              exit={
                reduce
                  ? { opacity: 0 }
                  : { height: 0, opacity: 0 }
              }
              transition={{
                duration: 0.28,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  "relative border-t border-accent-border/30 px-3 py-2.5",
                  "font-mono text-[11.5px] leading-[1.55]",
                  "text-muted-foreground",
                  "whitespace-pre-wrap break-words"
                )}
              >
                {text || (isPending ? <PendingDots /> : null)}

                {/* Streaming shimmer line — animated left-to-right
                    hairline at the bottom of the content so the user
                    sees tokens still arriving. Suppressed when
                    settled, and under reduced motion. */}
                {isLive && text.length > 0 && !reduce && (
                  <motion.span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute inset-x-3 bottom-0 h-px",
                      "bg-[linear-gradient(90deg,transparent,var(--accent-border),transparent)]",
                      "bg-[length:30%_100%] bg-no-repeat"
                    )}
                    initial={{ backgroundPosition: "-30% 0" }}
                    animate={{ backgroundPosition: "130% 0" }}
                    transition={{
                      duration: 1.4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Visually hidden status announcer — a *sibling* of
          the landmark so screen readers don't conflate the
          live-region copy ("Reasoning finished") with the
          landmark label on a single focus pass. `aria-atomic`
          ensures each transition reads as a single sentence.
          The chip's status copy inside the landmark is the
          sighted UX; this hidden region is the assistive
          re-engagement signal. */}
      <span
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        data-testid="reasoning-status-announcer"
      >
        {isLive
          ? "Reasoning in progress"
          : isDone
            ? "Reasoning finished"
            : ""}
      </span>
    </Fragment>
  );
}

/**
 * Animated pending-state placeholder. Three dots fade in and out
 * with a 120 ms staggered offset. Rendered when the reasoning
 * chain has started streaming but no text has arrived yet
 * (typical for the first ~50-150 ms of an extended-thinking
 * call). The animation is suppressed under reduced motion.
 */
function PendingDots() {
  const reduce = useReducedMotion();
  return (
    <span
      data-testid="reasoning-pending"
      className="inline-flex items-center gap-1 text-muted-foreground/60"
      aria-label="Waiting for first reasoning token"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className="h-1 w-1 rounded-full bg-muted-foreground/60"
          initial={{ opacity: reduce ? 0.4 : 0.2 }}
          animate={
            reduce
              ? undefined
              : { opacity: [0.2, 0.9, 0.2] }
          }
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

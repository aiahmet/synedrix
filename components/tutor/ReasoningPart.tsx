"use client";

import { Fragment, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import { Brain, CaretDown, Sparkle } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils/cn";

/**
 * Auto-collapse threshold (chars). Reasoning chains shorter than this
 * stay open when they finish because they read at a glance; longer
 * traces collapse so the user focuses on the answer unless they opt
 * to peek behind the curtain.
 */
const AUTO_COLLAPSE_THRESHOLD = 280;

/**
 * deriveInitialOpen.
 *
 * Decides whether a reasoning trace should ship in the
 * collapsed or expanded state on first render. The
 * rationale:
 *
 *  - **Live** (`state === "streaming"`): always open so the
 *    user sees tokens land as they arrive.
 *  - **Settled and short** (`state === "done"` and within
 *    the visibility threshold): stays open — these read
 *    at a glance ("Looking up the formula. Found it.").
 *  - **Settled and long** (`state === "done"` and past the
 *    threshold): starts collapsed so the final answer
 *    above-the-fold isn't pushed by older traces the
 *    user already dwelled through.
 *
 * Crucially, this is computed from props at mount time
 * only — so the *first* render after hydration matches
 * the *SSR* render deterministically. (Calling
 * `setOpen(false)` inside a `useEffect` would fire a
 * second render post-hydration and produce a visible
 * flicker on settled long traces, plus trigger the
 * "setState synchronously in effect" lint rule.)
 */
function deriveInitialOpen(
  text: string,
  state: "streaming" | "done"
): boolean {
  if (state === "streaming") return true;
  return text.length <= AUTO_COLLAPSE_THRESHOLD;
}

/**
 * ReasoningPart.
 *
 * Renders an AI SDK `ReasoningUIPart` (Deepseek / OpenAI o-series
 * / Anthropic extended-thinking models emit one of these BEFORE the
 * final text part). The streaming UI is deliberately understated:
 *
 *  - A soft pill with a `Brain` icon (no neon, no outer glow).
 *  - A calm pulse on the icon during the live stream, suppressed
 *    under `prefers-reduced-motion`.
 *  - Mono-flavoured reasoning body so it reads as the model's
 *    inner monologue rather than a polished reply.
 *  - Collapsible once the chain is done, with an animated height
 *    transition and a rotating caret.
 *  - A faint shimmer line at the bottom of the live content so
 *    the user sees that tokens are still arriving.
 *
 * The component is the only place in the tutor surface that knows
 * about reasoning parts, so future redesigns scope to this file
 * alone. It is `"use client"` (motion uses effects) but stateless
 * across renders other than the local `open` toggle.
 *
 * The render returns a Fragment so the screen-reader live-region
 * is a *sibling* of the `role="group"` landmark — assistive tech
 * does not conflate the live copy ("Reasoning finished") with the
 * landmark label on a single focus pass.
 */
export interface ReasoningPartProps {
  /** Reasoning text dumped so far by the model. */
  readonly text: string;
  /**
   * Per-part streaming state from the AI SDK. Mirrors the
   * `TextUIPart.state` / `ReasoningUIPart.state` discriminated
   * union on `UIMessagePart`. Caller defaults to `"done"`
   * when undefined so historical messages from Convex render
   * in their settled form.
   */
  readonly state: "streaming" | "done";
}

export function ReasoningPart({
  text,
  state,
}: ReasoningPartProps) {
  const reduce = useReducedMotion();
  // Initial value is derived from props so the first
  // render (SSR + first client render) match. The user can
  // still toggle freely afterwards.
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
            "group flex w-full items-center gap-2 px-2.5 py-1.5 text-left",
            "outline-none transition-colors duration-200",
            "hover:bg-accent-subtle/70",
            "focus-visible:bg-accent-subtle/70 focus-visible:ring-2",
            "focus-visible:ring-ring focus-visible:ring-offset-1",
            "focus-visible:ring-offset-accent-subtle/40"
          )}
        >
          {/* Brain icon with a calm pulse halo when the chain is
              live. The halo is purely decorative and is suppressed
              under reduced-motion. */}
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

          {/* Live/settled status chip — the LIVE chip breathes a slow
              opacity ramp; the SETTLED chip swaps to a tiny sparkle so
              the seam between live and done stays quiet. */}
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
                  // Show trailing whitespace so a long running
                  // reasoning chain visibly extends as it grows.
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

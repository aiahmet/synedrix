"use client";

import { useEffect, useState } from "react";
import { Pulse, Sparkle } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils/cn";

/**
 * StreamingIndicator.
 *
 * The "thinking" chip rendered while the AI is
 * preparing its answer. Replaces the previous
 * "The tutor is warming up…" with a more
 * deliberate four-stage tracker:
 *
 *   1. Reading mastery — checking per-topic mastery
 *      + confidence
 *   2. Checking mistakes — pulling recent mistakes
 *   3. Building example — assembling an explanation
 *   4. Rendering answer — streaming tokens
 *
 * The chip animates a slow pulse on the icon and
 * steps through the labels on a fixed cadence so the
 * user reads the AI as preparing a real reply
 * rather than waiting on a spinner. The cadence is
 * calibrated so the *first* label stays put for a
 * beat (the upstream request needs to do its own
 * work) and the *last* label settles a moment
 * before the stream actually arrives.
 *
 * Why four stages rather than a single label: the
 * user expects Copilot / Notion AI to *show what it
 * is doing*. A pipeline breakdown matches that
 * mental model and makes the wait feel shorter
 * because the user reads it as work-in-progress
 * rather than stall.
 */
export function StreamingIndicator({
  status,
}: {
  readonly status: "submitted" | "streaming" | "ready" | "error";
}) {
  if (status !== "submitted" && status !== "streaming") return null;
  return <StreamingIndicatorImpl status={status} />;
}

/**
 * Impl component keeps the rotating-state timer
 * scoped — we only mount it while the parent says
 * we're streaming, so the rotation never runs while
 * the user is reading the AI's reply.
 */
function StreamingIndicatorImpl({
  status,
}: {
  readonly status: "submitted" | "streaming";
}) {
  const stages = STAGES;
  const [stage, setStage] = useState<number>(0);
  useEffect(() => {
    // Tick once every 2.4 s. When the AI starts
    // actually streaming (status === "streaming") we
    // skip to the last stage so the chip settles a
    // beat before the first token arrives.
    const id = window.setInterval(() => {
      setStage((prev) => {
        if (status === "streaming") return stages.length - 1;
        return Math.min(prev + 1, stages.length - 1);
      });
    }, 2400);
    return () => window.clearInterval(id);
  }, [status, stages.length]);
  const current = stages[stage] ?? stages[0]!;
  const isStreaming = status === "streaming";
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-start gap-2.5 px-9 py-1"
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle/70 text-accent"
          )}
          aria-hidden
        >
          {isStreaming ? (
            <Sparkle className="h-3.5 w-3.5" weight="duotone" />
          ) : (
            <Pulse className="h-3.5 w-3.5 animate-pulse" weight="duotone" />
          )}
        </span>
        <div className="flex flex-col">
          <p className="text-[12.5px] font-medium tracking-tight text-foreground">
            {current.title}
          </p>
          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            {current.detail}
          </p>
        </div>
      </div>
      {status === "submitted" && (
        <ol className="ml-10 flex items-center gap-1.5">
          {stages.map((s, idx) => (
            <li key={s.title} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-3 rounded-full transition-colors duration-700",
                  idx <= stage ? "bg-accent" : "bg-border"
                )}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const STAGES: ReadonlyArray<{ title: string; detail: string }> = [
  {
    title: "Reading mastery",
    detail: "Pulling current mastery and recent mistakes on this topic.",
  },
  {
    title: "Checking mistakes",
    detail: "Looking for patterns in your last five attempts.",
  },
  {
    title: "Building example",
    detail: "Selecting the explanation style that fits the gap.",
  },
  {
    title: "Rendering answer",
    detail: "Streaming back the explanation step by step.",
  },
];

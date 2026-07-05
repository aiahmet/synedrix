"use client";

import {
  ArrowRight,
  ChartLine,
  Exam,
  GraduationCap,
  MathOperations,
  Pulse,
  Repeat,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils/cn";

/**
 * SuggestionDock.
 *
 * Six pre-built suggestion chips rendered under
 * every assistant message (once the stream settles).
 * Click a chip → the composer is auto-filled with a
 * prompt that, when sent, asks the tutor to do the
 * thing. The verbs are hard-coded (so we always have
 * the right UX even before the AI is briefed); the
 * topic title is plumbed in from props so the
 * suggestions stay on-topic without a round trip.
 *
 * Layout: a horizontal flex wrapped to a second row
 * at narrow widths. Each chip carries an icon +
 * short verb + a one-line preview of the prompt.
 * Hover scales the chip 1.5% so the click target
 * feels alive without distracting the bubble above.
 *
 * Streaming state: while the model is still
 * thinking the dock hides — showing the chips
 * mid-stream would let the user fire a competing
 * prompt at a partial reply.
 */
export function SuggestionDock({
  topicTitle,
  onPick,
  isStreaming,
}: {
  readonly topicTitle: string | null;
  readonly onPick: (prompt: string) => void;
  readonly isStreaming: boolean;
}) {
  if (isStreaming) {
    // Reserves the dock's vertical space so the chat
    // surface doesn't jump when the stream settles and
    // the chips appear.
    return (
      <div className="mt-2 h-7 opacity-0" aria-hidden />
    );
  }
  const title = topicTitle ?? "this topic";
  const items = buildSuggestions(title);
  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Continue learning suggestions"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onPick(item.prompt)}
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated/80 px-2.5 py-1 text-[11px] font-medium text-foreground transition-all hover:scale-[1.015] hover:border-accent-border/70 hover:bg-accent-subtle/40 hover:text-accent active:scale-[0.99]"
          )}
          title={item.prompt}
        >
          <span aria-hidden>{item.icon}</span>
          <span>{item.label}</span>
          <ArrowRight className="h-2.5 w-2.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" weight="bold" />
        </button>
      ))}
    </div>
  );
}

/**
 * Build the six dock items from the topic title. The
 * verbs are deliberately generic — the AI has its own
 * understanding of what "Harder example" should look
 * like for the user, so the prompt lets it compute
 * the specific instance.
 */
function buildSuggestions(topicTitle: string): ReadonlyArray<{
  label: string;
  prompt: string;
  icon: React.ReactNode;
}> {
  return [
    {
      label: "Harder example",
      prompt: `Walk me through a harder example on ${topicTitle}. Push beyond what I just saw.`,
      icon: <Repeat className="h-3 w-3" weight="duotone" />,
    },
    {
      label: "Easier explanation",
      prompt: `Explain ${topicTitle} more simply. Use everyday analogies, no jargon.`,
      icon: <Pulse className="h-3 w-3" weight="duotone" />,
    },
    {
      label: "Visualize it",
      prompt: `Show me a visualization of ${topicTitle}. Use a diagram or step-by-step picture.`,
      icon: <ChartLine className="h-3 w-3" weight="duotone" />,
    },
    {
      label: "Quiz me",
      prompt: `Quiz me on ${topicTitle}. One question at a time, then check my answer.`,
      icon: <GraduationCap className="h-3 w-3" weight="duotone" />,
    },
    {
      label: "Exam-style",
      prompt: `Give me an exam-style question on ${topicTitle}. Marked to the German 1-6 scale.`,
      icon: <Exam className="h-3 w-3" weight="duotone" />,
    },
    {
      label: "Re-explain",
      prompt: `Re-explain what you just said about ${topicTitle} from a different angle.`,
      icon: <MathOperations className="h-3 w-3" weight="duotone" />,
    },
  ];
}

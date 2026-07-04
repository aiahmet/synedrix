import { cn } from "@/lib/utils/cn";
import { ChatCircleText, Sparkle } from "@/components/landing/icons";

/**
 * TopicMock.
 *
 * Real preview of the atomic learning screen. The three depths
 * (Simple / Standard / Rigorous) live as tabs on a single page so
 * the user never navigates away from the topic.
 *
 * The right column shows a slice of the AI Tutor sidecar with the
 * context it already knows: subject, topic, mastery, recent
 * mistakes, and a stale-card prompt.
 */

const DEPTHS = [
  {
    key: "simple" as const,
    label: "Simple",
    body: "A logarithm answers the question: what power do I raise this base to?",
  },
  {
    key: "standard" as const,
    label: "Standard",
    body: "For log_a(x) to be defined, a > 0, a \u2260 1, and x > 0. The change-of-base formula converts any log to ln(x) / ln(a).",
  },
  {
    key: "rigorous" as const,
    label: "Rigorous",
    body: "Define a^x as exp(x ln a). Then log_a is the inverse on its domain; derivatives follow from the chain rule on the ln.",
  },
];

const ACTIVE_DEPTH = "standard" as const;

const MISTAKES: readonly string[] = [
  "Sign error on ln(a \u00b7 b)",
  "Forgot x > 0 check on input",
  "Mixed change-of-base bases",
];

export function TopicMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative isolate flex flex-col gap-3 overflow-hidden rounded-3xl border border-border bg-surface-elevated p-5 shadow-[var(--shadow-pop)]",
        className
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
            {"Topic \u00b7 Math"}
          </p>
          <h3 className="mt-1 truncate text-[16px] font-semibold tracking-tight text-foreground">
            Logarithmic equations
          </h3>
          <p className="text-[11.5px] text-muted-foreground">
            Math \u00b7 Grade 11 \u00b7 25 min estimated
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-2.5 text-[11px] font-medium tabular-nums text-foreground">
            <span className="font-mono text-accent">62%</span>
            <span className="ml-1.5 text-muted-foreground">mastery</span>
          </span>
          <span className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-2.5 text-[11px] font-medium text-foreground">
            Confidence
            <span className="ml-1.5 inline-block h-1.5 w-12 overflow-hidden rounded-full bg-border">
              <span className="block h-full w-[45%] rounded-full bg-accent" />
            </span>
          </span>
        </div>
      </header>

      {/* Three depth tabs. */}
      <div role="tablist" aria-label="Depth" className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
        {DEPTHS.map((d) => {
          const active = d.key === ACTIVE_DEPTH;
          return (
            <button
              key={d.key}
              role="tab"
              aria-selected={active}
              type="button"
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              )}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="md:col-span-3 space-y-2.5">
          <div className="rounded-xl border border-border bg-surface p-3.5">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
              Explanation
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground">
              {DEPTHS[1].body}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-3.5">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
              Common mistakes
            </p>
            <ul className="mt-1.5 space-y-1">
              {MISTAKES.map((m) => (
                <li key={m} className="flex items-start gap-2 text-[12px] text-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-subject-french" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* AI tutor sidecar, context-aware. */}
        <aside className="md:col-span-2 rounded-xl border border-accent-border/40 bg-accent-subtle/40 p-3.5">
          <p className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
            <ChatCircleText className="h-3 w-3" weight="duotone" />
            Tutor
          </p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-foreground">
            You have signed errors on <span className="font-medium">3 of 8</span>{" "}
            recent log problems. Want a Socratic walk-through of the change-of-base step?
          </p>

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {["Explain simpler", "Hint only", "Quiz me", "Summarize"].map((mode) => (
              <button
                key={mode}
                type="button"
                className="rounded-md border border-accent-border/50 bg-surface-elevated px-2 py-1 text-[10.5px] font-medium text-foreground hover:border-accent"
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5">
            <Sparkle className="h-3 w-3 text-accent" weight="duotone" />
            <span className="text-[10.5px] text-muted-foreground">
              Context: 3 recent mistakes on this topic
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

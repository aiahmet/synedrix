import { cn } from "@/lib/utils/cn";
import { Sparkle } from "@/components/landing/icons";

/**
 * TutorMock.
 *
 * Real preview of an AI tutor session. Shows the context recap the
 * tutor holds for the topic, the pre-configured modes, and the
 * telemetry row that the AiGeneration table writes after every call.
 *
 * Streaming is implied by the typewriter cursor at the bottom of the
 * assistant message; the assistant is still composing a longer answer.
 */

const MODES = [
  "Explain simpler",
  "Hint only",
  "Quiz me",
  "Check my answer",
  "Socratic",
  "Summarize",
];

export function TutorMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-3xl border border-border bg-surface-elevated shadow-[var(--shadow-pop)]",
        className
      )}
    >
      <header className="flex items-center justify-between border-b border-border/80 px-4 py-3">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
            Tutor session
          </p>
          <p className="text-[12.5px] font-medium text-foreground">
            Math \u00b7 Logarithmic equations
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-6 items-center rounded-full border border-accent-border/60 bg-accent-subtle/40 px-2 text-[10.5px] font-medium text-accent">
            hint only
          </span>
        </div>
      </header>

      <div className="space-y-3 p-4">
        {/* Context recalled in the session. */}
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
            <Sparkle className="h-3 w-3" weight="duotone" />
            Context held this session
          </p>
          <ul className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px] text-foreground">
            {[
              { k: "Subject", v: "Math" },
              { k: "Topic", v: "Logarithmic equations" },
              { k: "Mastery", v: "62%" },
              { k: "Recent mistakes", v: "3 on this topic" },
            ].map((ctx) => (
              <li
                key={ctx.k}
                className="flex items-center justify-between rounded-md border border-border/60 bg-background px-2 py-1"
              >
                <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {ctx.k}
                </span>
                <span className="font-mono text-[11px]">{ctx.v}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Conversation transcript. */}
        <div className="space-y-2">
          <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-accent/15 px-3 py-2 text-[12px] leading-snug text-foreground">
            Why does combining log\u2082(x) + log\u2082(x \u2212 2) still need a domain check?
          </div>
          <div className="mr-auto max-w-[90%] rounded-xl rounded-tl-sm border border-border bg-surface px-3 py-2 text-[12px] leading-snug text-foreground">
            You can combine, but the domain rules travel with each log. So
            before you exponentiate, ask what makes each log defined: x &gt; 0
            and x \u2212 2 &gt; 0. Domain gives you{" "}
            <span className="font-mono text-accent">x &gt; 2</span>, which
            filters out one{" "}
            <span aria-hidden className="inline-block h-3 w-[2px] translate-y-0.5 animate-pulse bg-accent align-middle" />
          </div>
        </div>

        {/* Mode pills. */}
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
            Switch mode
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {MODES.map((m, i) => {
              const active = i === 1;
              return (
                <span
                  key={m}
                  className={cn(
                    "inline-flex h-7 items-center rounded-full border px-2.5 text-[10.5px] font-medium",
                    active
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m}
                </span>
              );
            })}
          </div>
        </div>

        {/* Telemetry row written after this turn. */}
        <div className="flex items-center justify-between rounded-md border border-border bg-surface-sunken/60 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">
          <span>
            AiGeneration &rarr; task=&quot;hint&quot;, model=&quot;openrouter/...&quot;, tokens=421,
            latency=812ms
          </span>
          <span className="font-mono text-accent">schemaValid=true</span>
        </div>
      </div>
    </div>
  );
}

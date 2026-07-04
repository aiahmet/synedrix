import { cn } from "@/lib/utils/cn";

/**
 * PracticeMock.
 *
 * Shows an actual question with a live hint ladder, a student's
 * answer, and a step-by-step feedback card from the evaluator. The
 * verdict pill, the hint cards, and the scored rubric are honest
 * components, not lorem-ipsum blocks.
 */

export function PracticeMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-3xl border border-border bg-surface-elevated shadow-[var(--shadow-pop)]",
        className
      )}
    >
      <header className="flex items-center justify-between border-b border-border/80 bg-surface-sunken/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
            Drill \u00b7 math / logs
          </span>
          <span className="font-mono text-[10.5px] text-muted-foreground">
            Q 3 of 6
          </span>
        </div>
        <span className="inline-flex h-6 items-center rounded-full bg-accent/15 px-2 text-[10.5px] font-medium text-accent">
          step_problem
        </span>
      </header>

      <div className="grid grid-cols-1 gap-px bg-border-faint md:grid-cols-12">
        <section className="bg-surface-elevated p-4 md:col-span-7">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
            Question
          </p>
          <p className="mt-1.5 text-[14px] font-medium leading-snug text-foreground">
            Solve for x where log\u2082(x) + log\u2082(x \u2212 2) = 3.
          </p>

          <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
            Your answer
          </p>
          <pre className="mt-1.5 overflow-x-auto rounded-md border border-border bg-surface px-3 py-2 font-mono text-[12px] text-foreground">
            x = 3
          </pre>

          <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
            Hint ladder
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {[
              { n: 1, text: "Combine the two logs into one.", used: true },
              { n: 2, text: "Raise both sides as a power of the base.", used: false },
              { n: 3, text: "Domain check before solving the quadratic.", used: false },
            ].map((hint) => (
              <li
                key={hint.n}
                className="flex items-start gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11.5px] text-foreground"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded font-mono text-[9.5px]",
                    hint.used
                      ? "bg-accent text-accent-foreground"
                      : "bg-border text-muted-foreground"
                  )}
                >
                  {hint.n}
                </span>
                <span className={hint.used ? "" : "text-muted-foreground"}>
                  {hint.text}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="bg-surface-elevated p-4 md:col-span-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
              Verdict
            </p>
            <span className="inline-flex h-6 items-center rounded-full bg-subject-french/15 px-2 text-[10.5px] font-medium text-subject-french">
              partially correct
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-foreground">
            Domain passes. Algebra is correct, but you dropped the second root
            between steps. Full solution below.
          </p>

          <ol className="mt-3 space-y-2 text-[11.5px] leading-relaxed">
            <li className="rounded-md border border-border bg-surface px-2.5 py-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">1.</span>{" "}
              Combine:{" "}
              <span className="font-mono">log\u2082(x(x \u2212 2)) = 3</span>
            </li>
            <li className="rounded-md border border-border bg-surface px-2.5 py-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">2.</span>{" "}
              Rewrite: <span className="font-mono">x(x \u2212 2) = 2\u00b3=8</span>
            </li>
            <li className="rounded-md border border-border bg-surface px-2.5 py-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">3.</span>{" "}
              Solve:{" "}
              <span className="font-mono">x\u00b2 \u2212 2x \u2212 8 = 0</span>{" "}
              \u2192{" "}
              <span className="font-mono text-accent">x \u2208 {"{4, \u22122}"}</span>
            </li>
            <li className="rounded-md border border-accent/30 bg-accent-subtle/40 px-2.5 py-1.5">
              <span className="font-mono text-[10px] text-accent">4.</span>{" "}
              Domain: x &gt; 2, so only x = 4 survives.
            </li>
          </ol>

          <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-surface px-2.5 py-2 text-[11px]">
            <span className="text-muted-foreground">Save this to journal</span>
            <span className="font-mono text-[10.5px] text-accent">log mistake \u2192</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

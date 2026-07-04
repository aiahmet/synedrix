import { cn } from "@/lib/utils/cn";

/**
 * DashboardMock.
 *
 * Real product preview built from honest primitives, not a div soup.
 * Shows the kinds of widgets the Cockpit ships with: a daily mission card,
 * weak-topic list with confidence sliders, the due-today queue pulled
 * from FlashcardReview.dueAt, and a recent-mistake replay row.
 *
 * Mock data is intentionally calm and specific (no 99.9% vanity numbers).
 * The whole component pivots on a single accent hue so it does not
 * compete visually with the hero headline.
 */

const WEAK_TOPICS: readonly {
  readonly subject: "math" | "physics" | "french";
  readonly title: string;
  readonly mastery: number;
  readonly lastSeen: string;
}[] = [
  { subject: "math", title: "Logarithmic equations", mastery: 0.42, lastSeen: "2d" },
  { subject: "french", title: "Subjonctif present", mastery: 0.37, lastSeen: "5d" },
  { subject: "physics", title: "Inductive reactance", mastery: 0.55, lastSeen: "1d" },
];

const DUE_CARDS: readonly {
  readonly deck: string;
  readonly front: string;
  readonly kind: "card" | "mistake";
}[] = [
  { deck: "Logarithms", front: "log_a(x) = ln(x)/ln(a)", kind: "card" },
  { deck: "Subjonctif", front: "Il faut que tu ___ ailles", kind: "card" },
  { deck: "Mistakes · Math", front: "Why sign-error on ln(a*b)?", kind: "mistake" },
  { deck: "Physics · XII", front: "X_L = \u03c9L: derive it", kind: "card" },
];

const SUBJECT_TONE: Record<typeof WEAK_TOPICS[number]["subject"], string> = {
  math: "bg-subject-math/10 text-subject-math",
  physics: "bg-subject-physics/10 text-subject-physics",
  french: "bg-subject-french/10 text-subject-french",
};

export function DashboardMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-3xl border border-border bg-surface-elevated shadow-[var(--shadow-pop)]",
        className
      )}
    >
      {/* Faint halo behind the card so it feels like a real surface, not a sticker. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[var(--halo-1)] blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-[var(--halo-2)] blur-3xl"
      />

      <header className="relative flex items-center justify-between border-b border-border/80 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/12 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
            SX
          </span>
          <div className="flex flex-col">
            <span className="text-[12px] font-semibold leading-tight text-foreground">
              The Cockpit
            </span>
            <span className="text-[10.5px] leading-tight text-muted-foreground">
              synedrix.app / dashboard
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Live
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-px bg-border-faint md:grid-cols-12">
        {/* Daily mission */}
        <article className="bg-surface-elevated p-5 md:col-span-7">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-accent">
            Today&rsquo;s mission
          </p>
          <h3 className="mt-1.5 text-[17px] font-semibold leading-tight tracking-tight text-foreground">
            Recover two weak foundations
          </h3>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            23 min &middot; estimated by current mastery
          </p>

          <div className="mt-4 flex items-stretch gap-1 overflow-hidden rounded-lg border border-border bg-surface">
            <div className="h-1 flex-1 bg-accent" />
            <div className="h-1 flex-1 bg-accent/40" />
            <div className="h-1 flex-1 bg-border" />
            <div className="h-1 flex-1 bg-border" />
          </div>
          <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">
            2 of 4 segments
          </p>
        </article>

        {/* Quick stats */}
        <article className="bg-surface-elevated p-5 md:col-span-5">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-accent">
            This week
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                Sessions
              </dt>
              <dd className="mt-1 font-mono text-[18px] font-semibold tabular-nums text-foreground">
                12
              </dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                Reviewed
              </dt>
              <dd className="mt-1 font-mono text-[18px] font-semibold tabular-nums text-foreground">
                74
                <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                  /80
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                Mistakes logged
              </dt>
              <dd className="mt-1 font-mono text-[18px] font-semibold tabular-nums text-foreground">
                6
              </dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                Streak
              </dt>
              <dd className="mt-1 font-mono text-[18px] font-semibold tabular-nums text-foreground">
                9d
              </dd>
            </div>
          </dl>
        </article>

        {/* Weak topics */}
        <article className="bg-surface-elevated p-5 md:col-span-7">
          <div className="flex items-baseline justify-between">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-accent">
              Weak topics
            </p>
            <span className="text-[10.5px] text-muted-foreground">
              ranked by mastery
            </span>
          </div>
          <ul className="mt-3 space-y-2.5">
            {WEAK_TOPICS.map((topic) => {
              const masteryPct = Math.round(topic.mastery * 100);
              return (
                <li
                  key={topic.title}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
                >
                  <span
                    className={cn(
                      "inline-flex h-6 items-center rounded-md px-2 text-[10px] font-medium uppercase tracking-[0.1em]",
                      SUBJECT_TONE[topic.subject]
                    )}
                  >
                    {topic.subject}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-foreground">
                      {topic.title}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-border">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full bg-accent"
                          style={{ width: `${masteryPct}%` }}
                        />
                      </span>
                      <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                        {masteryPct}%
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    {topic.lastSeen}
                  </span>
                </li>
              );
            })}
          </ul>
        </article>

        {/* Review queue */}
        <article className="bg-surface-elevated p-5 md:col-span-5">
          <div className="flex items-baseline justify-between">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-accent">
              Due today
            </p>
            <span className="font-mono text-[10.5px] text-muted-foreground">
              9 items
            </span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {DUE_CARDS.map((card) => (
              <li
                key={card.front}
                className="flex items-center gap-2.5 rounded-md border border-border/60 bg-surface px-2.5 py-2"
              >
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded px-1.5 font-mono text-[9.5px] uppercase",
                    card.kind === "card"
                      ? "bg-accent/12 text-accent"
                      : "bg-subject-french/15 text-subject-french"
                  )}
                >
                  {card.kind === "card" ? "card" : "mistake"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[11.5px] text-foreground">
                    {card.front}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {card.deck}
                  </p>
                </div>
              </li>
            ))}
            <li className="px-1 py-1 text-center">
              <span className="text-[10.5px] text-muted-foreground">
                + 5 more
              </span>
            </li>
          </ul>
        </article>
      </div>

      <footer className="flex items-center justify-between border-t border-border/80 bg-surface-sunken/60 px-5 py-2.5 text-[10.5px] font-mono text-muted-foreground">
        <span>auto-refresh: realtime via Convex</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-accent" />
          0.4s round-trip
        </span>
      </footer>
    </div>
  );
}

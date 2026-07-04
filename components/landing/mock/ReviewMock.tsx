import { cn } from "@/lib/utils/cn";

/**
 * ReviewMock.
 *
 * Real preview of the unified Review Center queue. Shows how a single
 * upcoming review pulls from three underlying sources (FlashcardReview,
 * MistakeEntry, stale UserTopicProgress) without a stored "queue" table.
 * The today / tomorrow / overdue badges reflect the same data the
 * spaced-repetition scheduler writes.
 */

const QUEUE: readonly {
  readonly id: string;
  readonly kind: "card" | "mistake" | "weak";
  readonly topic: string;
  readonly prompt: string;
  readonly window: "today" | "tomorrow" | "overdue";
  readonly interval: string;
}[] = [
  {
    id: "q1",
    kind: "card",
    topic: "Math / Logs",
    prompt: "log\u2082(x) domain rules",
    window: "today",
    interval: "2d",
  },
  {
    id: "q2",
    kind: "mistake",
    topic: "Physics / XII",
    prompt: "Sign on dU/dt = -L*I(dI/dt)",
    window: "today",
    interval: "1d",
  },
  {
    id: "q3",
    kind: "weak",
    topic: "French / Subjonctif",
    prompt: "Recover foundation",
    window: "today",
    interval: "3d",
  },
  {
    id: "q4",
    kind: "card",
    topic: "Math / Logs",
    prompt: "Change-of-base formula",
    window: "tomorrow",
    interval: "4d",
  },
  {
    id: "q5",
    kind: "card",
    topic: "Chemistry / Reactions",
    prompt: "Balancing redox half-reactions",
    window: "tomorrow",
    interval: "5d",
  },
  {
    id: "q6",
    kind: "mistake",
    topic: "German / Essays",
    prompt: "Vermutung not Vermutung.",
    window: "overdue",
    interval: "6d",
  },
];

const WINDOW_TONE: Record<typeof QUEUE[number]["window"], string> = {
  today: "bg-accent text-accent-foreground",
  tomorrow: "bg-surface text-muted-foreground border border-border",
  overdue: "bg-subject-french text-white",
};

const KIND_BADGE: Record<typeof QUEUE[number]["kind"], string> = {
  card: "border-border bg-surface text-muted-foreground",
  mistake: "border-subject-french/30 bg-subject-french/10 text-subject-french",
  weak: "border-subject-physics/30 bg-subject-physics/10 text-subject-physics",
};

export function ReviewMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-3xl border border-border bg-surface-elevated shadow-[var(--shadow-pop)]",
        className
      )}
    >
      <header className="flex items-center justify-between border-b border-border/80 px-4 py-2.5">
        <div>            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
            {"Today\u2019s queue"}
          </p>
          <p className="mt-0.5 text-[12.5px] font-medium text-foreground">
            {"3 due \u00b7 2 tomorrow \u00b7 1 overdue"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-6 items-center rounded-full border border-border bg-surface px-2 text-[10.5px] font-medium text-muted-foreground">
            unified
          </span>
          <span className="inline-flex h-6 items-center rounded-full bg-accent px-2 text-[10.5px] font-medium text-accent-foreground">
            start
          </span>
        </div>
      </header>

      <ul className="divide-y divide-border/80">
        {QUEUE.map((item) => (
          <li
            key={item.id}
            className="grid grid-cols-12 items-center gap-3 px-4 py-3"
          >
            <span
              className={cn(
                "col-span-2 inline-flex h-6 items-center justify-center rounded-md border px-2 font-mono text-[10.5px] uppercase",
                KIND_BADGE[item.kind]
              )}
            >
              {item.kind}
            </span>
            <div className="col-span-7 min-w-0">
              <p className="truncate text-[12.5px] font-medium text-foreground">
                {item.prompt}
              </p>
              <p className="truncate font-mono text-[10.5px] text-muted-foreground">
                {item.topic}
              </p>
            </div>
            <span className="col-span-1 font-mono text-[10.5px] text-muted-foreground">
              +{item.interval}
            </span>
            <span
              className={cn(
                "col-span-2 inline-flex h-6 items-center justify-center rounded-full px-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em]",
                WINDOW_TONE[item.window]
              )}
            >
              {item.window}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

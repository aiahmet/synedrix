"use client";

import { useMemo, useCallback, useState } from "react";
import { Preloaded, usePreloadedQuery } from "convex/react";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import {
  ClockCounterClockwise,
  Lightning,
  Warning,
  Function,
  Translate,
  FirstAid,
  ArrowRight,
} from "@phosphor-icons/react";

type QueueItem = {
  readonly kind: "flashcard" | "mistake" | "weak_topic" | "formula_pack" | "vocabulary_deck";
  readonly priority: number;
  readonly at: number;
  readonly title: string;
  readonly subtitle: string;
  readonly href: string;
  readonly subjectSlug: string | null;
  readonly subjectColor: string | null;
  readonly count: number | null;
  readonly topicId: string | null;
};

function resolveTone(color: string | null | undefined): string {
  if (!color) return "var(--color-accent)";
  return `var(--subject-${color})`;
}

const kindMeta: Record<
  QueueItem["kind"],
  { icon: typeof ClockCounterClockwise; label: string }
> = {
  flashcard: { icon: ClockCounterClockwise, label: "Flashcard review" },
  mistake: { icon: Warning, label: "Mistake replay" },
  weak_topic: { icon: Lightning, label: "Weak topic" },
  formula_pack: { icon: Function, label: "Formula pack" },
  vocabulary_deck: { icon: Translate, label: "Vocabulary deck" },
};

export function ReviewCenterClient({
  queuePreloaded,
}: {
  readonly queuePreloaded: Preloaded<typeof api.reviewCenter.getReviewQueue>;
}) {
  const data = usePreloadedQuery(queuePreloaded);

  const sections = useMemo(() => {
    const due: QueueItem[] = [];
    const dueToday: QueueItem[] = [];
    const weak: QueueItem[] = [];
    const packs: QueueItem[] = [];

    for (const item of data.items) {
      if (item.kind === "flashcard" || item.kind === "mistake") {
        if (item.priority >= 0.9) {
          due.push(item);
        } else {
          dueToday.push(item);
        }
      } else if (item.kind === "weak_topic") {
        weak.push(item);
      } else {
        packs.push(item);
      }
    }

    return { due, dueToday, weak, packs };
  }, [data.items]);

  const [rescueState, setRescueState] = useState<
    "idle" | "loading" | "error"
  >("idle");

  const handleRescuePlan = useCallback(() => {
    setRescueState("loading");
    fetch("/api/review/rescue-plan", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Rescue plan generation failed");
        }
        const result = await res.json() as { redirectUrl: string };
        window.location.href = result.redirectUrl;
      })
      .catch(() => {
        setRescueState("error");
      });
  }, []);

  if (data.items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          / review
        </span>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-balance text-[clamp(1.5rem,2vw+0.5rem,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
              Review Center
            </h1>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {data.overdueCount > 0
                ? `${data.overdueCount} overdue · `
                : ""}
              {data.dueTodayCount} due today · {data.weakTopicCount} weak topics
            </p>
          </div>
          {data.hasRescuePlanEligible && (
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={handleRescuePlan}
                disabled={rescueState === "loading"}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rescueState === "loading" ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-foreground border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FirstAid className="h-3.5 w-3.5" weight="duotone" />
                    Generate rescue plan
                  </>
                )}
              </button>
              {rescueState === "error" && (
                <p className="text-[11.5px] text-subject-french">
                  Could not generate plan — try again
                </p>
              )}
            </div>
          )}
        </div>
      </header>

      {sections.due.length > 0 && (
        <Section label="Overdue" items={sections.due} tone="var(--subject-french)" />
      )}

      {sections.dueToday.length > 0 && (
        <Section label="Due today" items={sections.dueToday} />
      )}

      {sections.weak.length > 0 && (
        <Section label="Weak foundations" items={sections.weak} />
      )}

      {sections.packs.length > 0 && (
        <Section label="Formula & vocabulary packs" items={sections.packs} />
      )}
    </div>
  );
}

function Section({
  label,
  items,
  tone,
}: {
  readonly label: string;
  readonly items: readonly QueueItem[];
  readonly tone?: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-[13.5px] font-medium leading-[1.2] tracking-[-0.005em] text-foreground">
        {label}
      </h2>
      <div className="flex flex-col gap-2">
        {items.map((item, idx) => (
          <ReviewQueueCard key={`${item.kind}-${idx}`} item={item} tone={tone} />
        ))}
      </div>
    </section>
  );
}

function ReviewQueueCard({
  item,
  tone: sectionTone,
}: {
  readonly item: QueueItem;
  readonly tone?: string;
}) {
  const { icon: Icon, label } = kindMeta[item.kind];
  const accentTone = item.subjectColor
    ? resolveTone(item.subjectColor)
    : sectionTone;

  return (
    <Link
      href={item.href}
      className="group flex items-center gap-3 rounded-md border border-border bg-background p-3.5 transition-colors hover:border-border hover:bg-surface"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{
          backgroundColor: accentTone
            ? `color-mix(in srgb, ${accentTone} 12%, transparent)`
            : "color-mix(in srgb, var(--color-accent) 12%, transparent)",
          color: accentTone ?? "var(--color-accent)",
        }}
        aria-hidden
      >
        <Icon className="h-4 w-4" weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-[1.2] tracking-[-0.005em] text-foreground">
          {item.title}
        </p>
        <p className="mt-0.5 truncate text-[12px] leading-relaxed text-muted-foreground">
          {item.subtitle}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {item.count !== null && item.count > 1 && (
          <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
            ×{item.count}
          </span>
        )}
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" weight="bold" />
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          / review
        </span>
        <h1 className="text-balance text-[clamp(1.5rem,2vw+0.5rem,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          Review Center
        </h1>
      </header>
      <div className="rounded-xl border border-border bg-background p-7 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] sm:p-8">
        <span
          className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--color-accent) 14%, transparent)",
            color: "var(--color-accent)",
          }}
          aria-hidden
        >
          <ClockCounterClockwise className="h-5 w-5" weight="duotone" />
        </span>
        <h2 className="mt-4 text-[16px] font-semibold tracking-tight text-foreground">
          Nothing to review
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
          Your review queue is empty. Study a topic, complete a practice
          run, or review some flashcards — items will surface here
          automatically.
        </p>
        <Link
          href="/subjects"
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
        >
          Browse subjects
          <ArrowRight className="h-3.5 w-3.5" weight="bold" />
        </Link>
      </div>
    </div>
  );
}

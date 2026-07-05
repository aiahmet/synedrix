"use client";

import { useQuery } from "convex/react";
import {
  ArrowRight,
  Brain,
  Check,
  Lightbulb,
  Pulse,
  Stack,
  Timer,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils/cn";
import { resolveColorVar } from "@/lib/utils/subjectColor";

/**
 * MemoryPanel.
 *
 * The right column of /tutor. Renders a continuous
 * readout of the user's *learning state* — a quick
 * reference so the user always knows what they
 * mastered, what they're weak on, and where they're
 * going next.
 *
 * Subscribes to `api.tutorMemory.getMemorySnapshot`
 * with the current (subjectId, topicId?) — the
 * graph flips the panel to live updates the moment
 * progress lands, mistakes are logged, or a session
 * ends. The shape returned is deliberately narrow
 * (mastery + weaknesses + recent progress + focus
 * goal + estimated minutes to mastery) — see
 * `convex/tutorMemory.ts` for the math.
 *
 * When the user is not signed in / no recent data
 * exists, the panel renders an empty skeleton rather
 * than crashing or going blank.
 */
export function MemoryPanel({
  subjectId,
  topicId,
  collapsed,
  onToggleCollapse,
}: {
  readonly subjectId: Id<"subjects">;
  readonly topicId: Id<"topics"> | null;
  readonly collapsed: boolean;
  readonly onToggleCollapse: () => void;
}) {
  const snapshot = useQuery(api.tutorMemory.getMemorySnapshot, { subjectId, topicId: topicId ?? undefined });

  if (collapsed) {
    return (
      <aside
        aria-label="Memory panel (collapsed)"
        className="flex w-14 shrink-0 flex-col items-center gap-3 rounded-l-2xl border-l border-y border-border bg-surface-elevated/60 py-3"
      >
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-subtle/70 text-accent"
          aria-hidden
        >
          <Brain className="h-4 w-4" weight="duotone" />
        </span>
        {snapshot && snapshot.topic && (
          <span
            aria-label={`Mastery ${Math.round(snapshot.topic.mastery * 100)} percent`}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-border font-mono text-[10px] font-semibold text-foreground"
            style={{
              borderColor: snapshot.topic.mastery >= 0.5 ? "var(--accent)" : "var(--border)",
            }}
          >
            {Math.round(snapshot.topic.mastery * 100)}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Open memory panel"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background transition-all hover:opacity-90"
        >
          <ArrowRight className="h-4 w-4" weight="bold" style={{ transform: "rotate(180deg)" }} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Memory panel"
      className="flex w-80 shrink-0 flex-col gap-3.5 rounded-l-2xl border-l border-y border-border bg-surface-elevated/40 px-4 py-4 shadow-[var(--shadow-soft)]"
    >
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-subtle/70 text-accent" aria-hidden>
            <Brain className="h-3 w-3" weight="duotone" />
          </span>
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            Memory
          </h2>
        </span>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Collapse memory panel"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
        >
          <ArrowRight className="h-3.5 w-3.5" weight="bold" />
        </button>
      </header>

      {snapshot === undefined ? (
        <MemorySkeleton />
      ) : snapshot === null ? (
        <MemorySignedOut />
      ) : snapshot.topic === null ? (
        <MemorySubjectOnly snapshot={snapshot as MemorySnapshotShape & { topic: null }} />
      ) : (
        <MemorySnapshot snapshot={snapshot as MemorySnapshotShape & { topic: MemoryTopicShape }} />
      )}
    </aside>
  );
}

/**
 * MemorySnapshot.
 *
 * The full panel render. Sections are stacked in
 * "most useful up" order:
 *
 *   1. Mastery ring + focus goal + estimated time
 *   2. Weaknesses (top 3 mistakes on this topic)
 *   3. Recently mastered (top 5 progress rows on
 *      this subject, newest first)
 *   4. Confidence — small inline progress to make
 *      the relationship between mastery & confidence
 *      visible at a glance
 */
export type MemoryTopicShape = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly mastery: number;
  readonly confidence: number;
  readonly difficulty: "EASY" | "MEDIUM" | "HARD";
  readonly gradeLevel: string | null;
};

export type MemorySnapshotShape = {
  readonly subject: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
  };
  readonly topic: MemoryTopicShape | null;
  readonly weaknesses: ReadonlyArray<{
    readonly id: string;
    readonly question: string;
    readonly userAnswer: string;
    readonly correctAnswer: string;
    readonly mistakeType: string;
    readonly cause: string | null;
    readonly attemptedAt: number;
  }>;
  readonly recentProgress: ReadonlyArray<{
    readonly topicId: string;
    readonly topicTitle: string;
    readonly topicSlug: string;
    readonly mastery: number;
    readonly lastStudiedAt: number;
  }>;
  readonly estimatedMinutesToMastery: number | null;
  readonly focusGoal: string | null;
  readonly subjectMastery: number;
};

function MemorySnapshot({
  snapshot,
}: {
  readonly snapshot: MemorySnapshotShape & { readonly topic: MemoryTopicShape };
}) {
  const topic = snapshot.topic;
  const fillVar = resolveColorVar(snapshot.subject.color);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto pb-1">
      <section className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-3">
        <div className="flex items-center gap-3">
          <MasteryPill mastery={topic.mastery} color={fillVar} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
              {snapshot.subject.title} · {topic.title}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {snapshot.focusGoal ?? "Stay current"}
            </p>
          </div>
        </div>
        <ConfidenceRow mastery={topic.mastery} confidence={topic.confidence} />
        {snapshot.estimatedMinutesToMastery !== null && (
          <p className="flex items-center gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
            <Timer className="h-3 w-3 text-accent" weight="duotone" />
            ~{snapshot.estimatedMinutesToMastery}m to first mastery at 50%
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <Warning className="h-3 w-3 text-subject-french" weight="duotone" />
          Weaknesses
        </h3>
        {snapshot.weaknesses.length === 0 ? (
          <EmptyHint
            icon={<Check className="h-3 w-3 text-accent" weight="duotone" />}
            text="No mistakes on this topic yet."
          />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {snapshot.weaknesses.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-border/60 bg-background px-2.5 py-2"
              >
                <p className="line-clamp-2 text-[12px] font-medium leading-snug text-foreground">
                  {m.question}
                </p>
                <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-muted-foreground">
                  You: <span className="text-subject-french">{m.userAnswer}</span> · Correct: <span className="text-accent">{m.correctAnswer}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {snapshot.recentProgress.length > 0 && (
        <section>
          <h3 className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <Check className="h-3 w-3 text-accent" weight="duotone" />
            Recently mastered
          </h3>
          <ul className="flex flex-col gap-1">
            {snapshot.recentProgress.map((p: MemorySnapshotShape["recentProgress"][number]) => (
              <li key={p.topicId} className="flex items-center gap-2 px-1.5 py-1">
                <Check className="h-3 w-3 shrink-0 text-accent" weight="bold" />
                <Link
                  href={`/subjects/${snapshot.subject.slug}/${
                    p.topicSlug
                  }`}
                  className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-foreground hover:underline"
                >
                  {p.topicTitle}
                </Link>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {Math.round(p.mastery * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-dashed border-border bg-surface-elevated/40 p-3">
        <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-accent" weight="duotone" />
          <span>
            Mastery is learned + applied; confidence is how sure you are at
            retrieval. Aim for both above 50% before declaring a topic done.
          </span>
        </p>
      </section>
    </div>
  );
}

/**
 * MemorySubjectOnly.
 *
 * The user is on a subject-only thread (no topic
 * pinned). The panel still surfaces subject-level
 * mastery + recent progress but skips the per-topic
 * confidence / weaknesses sections.
 */
function MemorySubjectOnly({
  snapshot,
}: {
  readonly snapshot: MemorySnapshotShape & { readonly topic: null };
}) {
  const fillVar = resolveColorVar(snapshot.subject.color);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto pb-1">
      <section className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-3">
        <div className="flex items-center gap-3">
          <MasteryPill mastery={snapshot.subjectMastery} color={fillVar} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
              {snapshot.subject.title}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {snapshot.focusGoal ?? "Pick a topic to drill in"}
            </p>
          </div>
        </div>
      </section>
      {snapshot.recentProgress.length === 0 ? (
        <EmptyHint
          icon={<Pulse className="h-3 w-3 text-muted-foreground animate-pulse" weight="duotone" />}
          text="No recent work on this subject yet."
        />
      ) : (
        <section>
          <h3 className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <Check className="h-3 w-3 text-accent" weight="duotone" />
            Recently studied
          </h3>
          <ul className="flex flex-col gap-1">
            {snapshot.recentProgress.map((p: MemorySnapshotShape["recentProgress"][number]) => (
              <li key={p.topicId} className="flex items-center gap-2 px-1.5 py-1">
                <Stack className="h-3 w-3 shrink-0 text-muted-foreground" weight="duotone" />
                <Link
                  href={`/subjects/${snapshot.subject.slug}/${p.topicSlug}`}
                  className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-foreground hover:underline"
                >
                  {p.topicTitle}
                </Link>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {Math.round(p.mastery * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * MemorySkeleton — loading state. Mirrors the
 * snapshot's shape so there is no layout jump when
 * the user state arrives.
 */
function MemorySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-hidden">
      <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-muted/30" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted/30" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/20" />
          </div>
        </div>
        <div className="h-2 animate-pulse rounded-full bg-muted/30" />
      </div>
      <div className="h-3 w-1/3 animate-pulse rounded bg-muted/30" />
      <div className="flex flex-col gap-1.5">
        <div className="h-3 w-full animate-pulse rounded bg-muted/20" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted/20" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-muted/20" />
      </div>
    </div>
  );
}

/**
 * MemorySignedOut.
 *
 * The query returns `null` for signed-out / newly-
 * created users. Render a small honest panel that
 * tells the user the memory feature depends on
 * being signed in.
 */
function MemorySignedOut() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
      <Brain className="h-8 w-8 text-muted-foreground" weight="duotone" />
      <p className="text-[12.5px] font-medium text-foreground">
        Memory unlocks with sign-in
      </p>
      <p className="max-w-[14rem] text-[11.5px] leading-relaxed text-muted-foreground">
        Once you sign in, mastery, weaknesses, and confidence land here
        live.
      </p>
    </div>
  );
}

/**
 * MasteryPill.
 *
 * Tiny mastery ring rendered in a compact chip
 * shape. Used twice in the panel header — once for
 * subject, once for topic. Loading / null state is
 * rendered as a 0% gray ring.
 */
function MasteryPill({
  mastery,
  color,
}: {
  readonly mastery: number;
  readonly color: string;
}) {
  const v = Math.max(0, Math.min(1, mastery));
  const pct = Math.round(v * 100);
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2"
      style={{
        borderColor: v >= 0.5 ? color : "var(--border)",
        backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
      }}
      aria-label={`Mastery ${pct} percent`}
    >
      <span className="font-mono text-[10px] font-semibold tabular-nums text-foreground">
        {pct}
        <span className="text-[7px] text-muted-foreground">%</span>
      </span>
    </div>
  );
}

/**
 * ConfidenceRow.
 *
 * Two stacked hairline bars: mastery on top, confidence
 * underneath. Color-coded so the relationship between
 * them is visible at a glance. Mental model: bars
 * crossing the 50% mark = mastery "earned" / confidence
 * "earned".
 */
function ConfidenceRow({
  mastery,
  confidence,
}: {
  readonly mastery: number;
  readonly confidence: number;
}) {
  const mPct = Math.round(mastery * 100);
  const cPct = Math.round(confidence * 100);
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <Bar label="Mastery" pct={mPct} color="var(--accent)" />
      <Bar label="Confidence" pct={cPct} color="var(--subject-chemistry)" />
    </div>
  );
}

function Bar({
  label,
  pct,
  color,
}: {
  readonly label: string;
  readonly pct: number;
  readonly color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 overflow-hidden rounded-full bg-surface">
        <div
          className="h-1.5 rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(2, pct)}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
        {pct}%
      </span>
    </div>
  );
}

function EmptyHint({
  icon,
  text,
}: {
  readonly icon: React.ReactNode;
  readonly text: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2.5 py-2 text-[11.5px] text-muted-foreground")}>
      {icon}
      <span>{text}</span>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import {
  ArrowRight,
  Check,
  Pulse,
  Sparkle,
  Target,
  Timer,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { formatRelativeDate } from "@/lib/format/relativeDate";

/**
 * A single topic row in the chapter's topic list.
 */
export interface TopicListEntry {
  readonly id: Id<"topics">;
  readonly slug: string;
  readonly title: string;
  readonly objectives: readonly string[];
  readonly examRelevance: number;
  readonly difficulty: "EASY" | "MEDIUM" | "HARD";
  readonly estimatedMinutes: number | undefined;
  readonly mastery: number;
  readonly lastStudiedAt: number | null;
  readonly isStudied: boolean;
}

/**
 * TopicList.
 *
 * Renders the topics under a single chapter. Each row is a
 * CockpitCard that shows the topic's title, a one-line
 * objective preview, exam-relevance and difficulty signals,
 * per-topic mastery bar, last-studied date, and a "Start
 * topic" CTA that fires a topic-scoped study session and
 * navigates to /tutor with subject + topic context.
 *
 * The CTAs are the only interactive piece. The list itself
 * is server-renderable; we use a client component here
 * because each CTA needs useMutation + useRouter.push.
 */
export function TopicList({
  topics,
  subject,
}: {
  readonly topics: readonly TopicListEntry[];
  readonly subject: {
    readonly id: Id<"subjects">;
    readonly slug: string;
  };
}) {
  if (topics.length === 0) {
    return (
      <CockpitCard>
        <div className="flex flex-col items-center gap-1 py-8 text-center">
          <p className="text-[13.5px] font-medium text-foreground">
            No topics indexed yet.
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            The author of this chapter has not added any topics.
          </p>
        </div>
      </CockpitCard>
    );
  }

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Topics"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            Sorted by exam relevance
          </span>
        }
      />
      <ol className="flex flex-col divide-y divide-border/60">
        {topics.map((t) => (
          <TopicRow key={t.id} topic={t} subject={subject} />
        ))}
      </ol>
    </CockpitCard>
  );
}

function TopicRow({
  topic,
  subject,
}: {
  readonly topic: TopicListEntry;
  readonly subject: { readonly id: Id<"subjects">; readonly slug: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const startSession = useMutation(api.studySessions.start);

  const pct = Math.round(topic.mastery * 100);
  const isEmpty = !topic.isStudied;
  const lastStudiedLabel = topic.lastStudiedAt
    ? formatRelativeDate(topic.lastStudiedAt)
    : "Not started";

  const onStart = () => {
    startTransition(async () => {
      try {
        await startSession({
          subjectId: subject.id,
          topicId: topic.id,
          intention: `Studying ${topic.title}`,
        });
        router.push(`/tutor?subject=${subject.slug}&topic=${topic.slug}`);
      } catch (err) {
        console.error("Failed to start topic session:", err);
      }
    });
  };

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
              {topic.title}
            </h3>
            <DifficultyPill difficulty={topic.difficulty} />
            <ExamRelevance relevance={topic.examRelevance} />
          </div>
          {topic.objectives.length > 0 && (
            <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {topic.objectives[0]}
              {topic.objectives.length > 1 && (
                <span className="text-muted-foreground/70">
                  {" "}
                  +{topic.objectives.length - 1} more objective
                  {topic.objectives.length - 1 === 1 ? "" : "s"}
                </span>
              )}
            </p>
          )}

          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 w-full max-w-[16rem] overflow-hidden rounded-full bg-surface">
              <div
                className={cn("h-full rounded-full transition-[width] duration-500")}
                style={{
                  width: `${Math.max(2, pct)}%`,
                  backgroundColor: isEmpty
                    ? "var(--muted)"
                    : "var(--accent)",
                }}
              />
            </div>
            <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
              {pct}%
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">
            {isEmpty ? (
              <span className="inline-flex items-center gap-1">
                <Timer className="h-3 w-3" weight="duotone" />
                Not started
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Check className="h-3 w-3" weight="bold" />
                Last studied {lastStudiedLabel}
              </span>
            )}
            {topic.estimatedMinutes !== undefined && (
              <>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span>~{topic.estimatedMinutes} min</span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={onStart}
            disabled={pending}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
              isEmpty
                ? "bg-foreground text-background hover:opacity-90"
                : "bg-accent text-accent-foreground hover:opacity-90"
            )}
          >
            {isEmpty ? (
              <Sparkle className="h-3.5 w-3.5" weight="duotone" />
            ) : (
              <Pulse className="h-3.5 w-3.5" weight="duotone" />
            )}
            {pending ? "Starting..." : "Start topic"}
            {!pending && (
              <ArrowRight className="h-3.5 w-3.5" weight="bold" />
            )}
          </button>
        </div>
      </div>
    </li>
  );
}

/**
 * Small pill that signals a topic's difficulty using a
 * subject-specific color token. Falls back to the global
 * accent so the signal is always visible.
 */
function DifficultyPill({
  difficulty,
}: {
  readonly difficulty: "EASY" | "MEDIUM" | "HARD";
}) {
  const colorVar =
    difficulty === "EASY"
      ? "var(--subject-chemistry)"
      : difficulty === "MEDIUM"
        ? "var(--subject-german)"
        : "var(--subject-french)";

  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.16em]"
      style={{
        backgroundColor: `color-mix(in srgb, ${colorVar} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${colorVar} 28%, transparent)`,
        color: colorVar,
      }}
    >
      {difficulty}
    </span>
  );
}

/**
 * Small badge that signals how exam-relevant a topic is,
 * using a high-contrast mono-uppercase label.
 */
function ExamRelevance({ relevance }: { readonly relevance: number }) {
  if (relevance < 1) return null;

  // Bucket the relevance score into a label so the user can
  // skim the list without reading each number.
  const label =
    relevance >= 4 ? "High yield" : relevance >= 2 ? "Core" : "Optional";

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
      <Target className="h-2.5 w-2.5" weight="bold" />
      {label}
    </span>
  );
}

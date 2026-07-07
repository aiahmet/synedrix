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
  UserCircle,
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
  /**
   * Discriminator per plan §4.2. `user` rows render
   * the "MY TOPIC" badge and link the title to the
   * `/my-topics/[slug]/lesson` page rather than the
   * canonical `/subjects/[s]/[c]/[t]` drilldown.
   */
  readonly source: "canonical" | "user";
  readonly ownerId: Id<"users"> | null;
}

/**
 * TopicList.
 *
 * Renders the topics under a single chapter. Each row is a
 * flat, single-layer list entry — typography does the work.
 * The previous version triple-nested every row inside a
 * `CockpitCard > TopicRow card > inner` stack; the rulebook
 * (§1) lists "carded list rows" as banned.
 *
 * Per `docs/SYNEDRIX-FRONTEND-STYLE.md`:
 *
 *   - **No pill chip containers.** Difficulty, exam-relevance,
 *     and "my topic" are plain uppercase muted text with
 *     optional color emphasis (§1).
 *
 *   - **No bouncy CTA.** The "Start topic" button drops
 *     `active:scale-[0.98]`.
 *
 *   - **`hover:bg-accent/90`** not `hover:opacity-90` (§6).
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
        <div className="flex flex-col items-center gap-1 py-6 text-center">
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
  const isUserTopic = topic.source === "user";

  const onStart = () => {
    if (isUserTopic) {
      startTransition(() => {
        router.push(`/my-topics/${topic.slug}/lesson`);
      });
      return;
    }
    startTransition(async () => {
      try {
        await startSession({
          subjectId: subject.id,
          topicId: topic.id,
          intention: `Studying ${topic.title}`,
        });
        router.push(
          `/tutor?subject=${subject.slug}&topic=${topic.slug}&from=${encodeURIComponent(
            `/subjects/${subject.slug}`,
          )}`,
        );
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
            <DifficultyLabel difficulty={topic.difficulty} />
            <ExamRelevanceLabel relevance={topic.examRelevance} />
            {isUserTopic && <MyTopicLabel />}
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
                className="h-full rounded-full transition-[width] duration-500"
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
              "inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              isUserTopic
                ? "border border-border bg-background text-foreground hover:bg-surface"
                : isEmpty
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "bg-accent text-accent-foreground hover:bg-accent/90",
            )}
          >
            {isUserTopic ? (
              <UserCircle className="h-3.5 w-3.5" weight="duotone" />
            ) : isEmpty ? (
              <Sparkle className="h-3.5 w-3.5" weight="duotone" />
            ) : (
              <Pulse className="h-3.5 w-3.5" weight="duotone" />
            )}
            {pending
              ? "Opening..."
              : isUserTopic
                ? "Open lesson"
                : "Start topic"}
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
 * Difficulty label. Plain uppercase mono with a per-difficulty
 * color, no pill container (§1).
 */
function DifficultyLabel({
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
      className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em]"
      style={{ color: colorVar }}
    >
      {difficulty}
    </span>
  );
}

/**
 * Exam-relevance label. Plain uppercase mono. Returns `null`
 * for relevance < 1 so the label never renders as "Optional"
 * for unreviewed topics.
 */
function ExamRelevanceLabel({ relevance }: { readonly relevance: number }) {
  if (relevance < 1) return null;
  const label =
    relevance >= 4 ? "High yield" : relevance >= 2 ? "Core" : "Optional";
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
      <Target className="h-2.5 w-2.5" weight="bold" />
      {label}
    </span>
  );
}

/**
 * "MY TOPIC" label for user-source rows. Plain uppercase mono
 * in the chemistry tone (green) so it reads as "yours /
 * authored" without conflicting with the difficulty or
 * exam-relevance labels.
 */
function MyTopicLabel() {
  return (
    <span
      className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em]"
      style={{ color: "var(--subject-chemistry)" }}
    >
      my topic
    </span>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";

import {
  CockpitCard,
  CockpitCardHeader,
} from "@/components/dashboard/CockpitCard";
import {
  ArrowLeft,
  ArrowRight,
  ChatCircleText,
  CheckCircle,
  Pulse,
  WarningCircle,
  X,
} from "@/components/landing/icons";
import {
  GERMAN_GRADE_LABELS,
  type GermanLetterGrade,
} from "@/lib/ai/prompts/grading";
import { AIMarkdown } from "@/lib/content/aiMarkdown";

interface RunItem {
  readonly itemId: string;
  readonly order: number;
  readonly prompt: string;
  readonly expectedAnswer: string;
  readonly skill: string;
  readonly rubric: readonly string[];
  readonly attempt: {
    readonly userAnswer: string;
    readonly verdict: "correct" | "partially_correct" | "incorrect";
    readonly score: number;
    readonly feedback: string;
    readonly betterAnswer: string;
    readonly attemptedAt: number;
  } | null;
  readonly mistake: {
    readonly id: string;
    readonly mistakeType: string;
    readonly cause: string | null;
  } | null;
}

/**
 * ResultsClient.
 *
 * Resolves the topic via `getOwnedTopicBySlug` (server-
 * side ownership check) and the latest run via
 * `getLatestPracticeRunForOwnedTopic` (same ownership
 * domain). Once both surface, renders the per-item
 * table + the German 1-6 letter grade + an entry into
 * the tutor with the run as context.
 */
export function ResultsClient({ topicSlug }: { readonly topicSlug: string }) {
  const router = useRouter();
  const topic = useQuery(api.topics.getOwnedTopicBySlug, { slug: topicSlug });
  const latestRun = useQuery(
    api.practice.getLatestPracticeRunForOwnedTopic,
    topic ? { topicId: topic.id } : "skip"
  );
  const runId = latestRun?.id ?? null;
  const run = useQuery(
    api.practice.getLessonPracticeRun,
    runId ? { runId } : "skip"
  );
  const items = useQuery(
    api.practice.getLessonPracticeRunItems,
    runId ? { runId } : "skip"
  );

  if (
    topic === undefined ||
    latestRun === undefined ||
    run === undefined ||
    items === undefined
  ) {
    return <Skeleton />;
  }

  if (!topic) {
    return (
      <CockpitCard>
        <Link
          href="/my-topics"
          className="block p-4 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          No topic matches <span className="font-mono">{topicSlug}</span>{" "}
          in your account — back to your topics →
        </Link>
      </CockpitCard>
    );
  }

  if (!run || run.status !== "graded") {
    return <NoGradeYet topicSlug={topicSlug} />;
  }

  const grade = (run.grade ?? "6") as GermanLetterGrade;
  const label = GERMAN_GRADE_LABELS[grade].label;
  const scorePct = Math.round((run.overallScore ?? 0) * 100);
  const gradeTone =
    grade === "1" || grade === "2"
      ? "var(--subject-chemistry)"
      : grade === "3"
        ? "var(--subject-german)"
        : "var(--subject-french)";

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5"
      >
        <Link
          href="/my-topics"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated/60 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm transition-colors hover:border-accent-border/60 hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" weight="bold" />
          Your topics
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="rounded-full bg-accent-subtle/40 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
          Results
        </span>
      </nav>

      <CockpitCard>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
          <div
            className="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-2xl border"
            style={{
              backgroundColor: `color-mix(in srgb, ${gradeTone} 12%, transparent)`,
              borderColor: `color-mix(in srgb, ${gradeTone} 40%, transparent)`,
            }}
          >
            <span
              className="text-[56px] font-semibold leading-none tracking-[-0.04em]"
              style={{ color: gradeTone }}
            >
              {grade}
            </span>
            <span
              className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.18em]"
              style={{ color: gradeTone }}
            >
              {label}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
              Run summary
            </span>
            <h1 className="text-balance text-[clamp(1.5rem,2vw+0.5rem,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
              {topic.title}
            </h1>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              {run.answeredCount} of {run.itemCount} answered · mean
              score {scorePct}%. Per-run grading uses the German
              Gymnasium 1 (sehr gut) to 6 (ungenügend) scale.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link
                href={`/tutor?subject=${encodeURIComponent(topic.subjectSlug)}&topic=${encodeURIComponent(topic.slug)}&lesson=${encodeURIComponent(run.id)}&q=${encodeURIComponent(
                  `Discuss my last practice on ${topic.title}. I got grade ${grade}.`
                )}&from=${encodeURIComponent(
                  `/my-topics/${topicSlug}/practice/results`
                )}`}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-accent/90"
              >
                <ChatCircleText className="h-3.5 w-3.5" weight="duotone" />
                Discuss with tutor
                <ArrowRight className="h-3.5 w-3.5" weight="bold" />
              </Link>
              <button
                type="button"
                onClick={() => router.push(`/my-topics/${topicSlug}/practice`)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface"
              >
                <Pulse className="h-3.5 w-3.5" weight="duotone" />
                Run another practice
              </button>
              <Link
                href={`/my-topics/${topicSlug}/lesson`}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
              >
                <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
                Back to lesson
              </Link>
            </div>
          </div>
        </div>
      </CockpitCard>

      <div className="flex flex-col gap-3">
        {items.map((item: RunItem, index: number) => (
          <ItemRow
            key={item.itemId}
            item={item}
            itemIndex={index}
            runId={run.id}
            topicSlug={topicSlug}
            subjectSlug={topic.subjectSlug}
            topicTitle={topic.title}
          />
        ))}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  itemIndex,
  runId,
  topicSlug,
  subjectSlug,
  topicTitle,
}: {
  readonly item: RunItem;
  readonly itemIndex: number;
  readonly runId: string;
  readonly topicSlug: string;
  readonly subjectSlug: string;
  readonly topicTitle: string;
}) {
  const verdict = item.attempt?.verdict ?? null;
  const verdictTone =
    verdict === "correct"
      ? "var(--subject-chemistry)"
      : verdict === "partially_correct"
        ? "var(--subject-german)"
        : "var(--subject-french)";
  const verdictLabel =
    verdict === "correct"
      ? "correct"
      : verdict === "partially_correct"
        ? "partial"
        : verdict === "incorrect"
          ? "wrong"
          : "no answer";
  const scorePct = item.attempt ? Math.round(item.attempt.score * 100) : 0;

  // Plan §2.4: per-item "Ask tutor about this question"
  // chip. Forwarded `?focusItemId=<itemIndex>` so the
  // tutor thread's welcome message names the question
  // and the AI's first reply is on-topic.
  const focusHref = `/tutor?subject=${encodeURIComponent(subjectSlug)}&topic=${encodeURIComponent(topicSlug)}&lesson=${encodeURIComponent(runId)}&focusItemId=${itemIndex}&q=${encodeURIComponent(`Help me with question ${itemIndex + 1} on ${topicTitle}.`)}&from=${encodeURIComponent(`/my-topics/${topicSlug}/practice/results`)}`;

  return (
    <CockpitCard>
      <CockpitCardHeader
        label={`Item ${item.order + 1}`}
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            skill: {item.skill}
          </span>
        }
      />
      {/* The item prompt is model-authored, so it gets the
          same AIMarkdown treatment. Two density profiles:
          bare for the prompt, compact for feedback/betterAnswer
          where the surrounding panel sets the visual context.
          The `id` keys are stable across re-renders of the
          same item because `item.itemId` is the Convex
          row's persistent id — it survives the run summary
          revalidation and any unrelated topic-state tick. */}
      <AIMarkdown
        id={`result-${item.itemId}-prompt`}
        content={item.prompt}
        density="bare"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Plan §2.4: per-item "Ask tutor about this
            question" chip. The `?focusItemId=<index>`
            is forwarded to the tutor thread's welcome
            message so the AI's first reply is on the
            specific question. Hidden on items that
            were not answered (no `attempt` row) — a
            blank question is not worth asking about. */}
        {item.attempt && (
          <Link
            href={focusHref}
            className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-surface-elevated px-2.5 text-[11.5px] font-medium text-foreground transition-colors hover:border-accent-border/60 hover:bg-surface"
          >
            <ChatCircleText
              className="h-3 w-3"
              weight="duotone"
            />
            Ask tutor about this
          </Link>
        )}
        <span
          className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em]"
          style={{
            backgroundColor: `color-mix(in srgb, ${verdictTone} 12%, transparent)`,
            borderColor: `color-mix(in srgb, ${verdictTone} 36%, transparent)`,
            color: verdictTone,
          }}
        >
          {verdict ? (
            <CheckCircle className="mr-1 h-3 w-3" weight="bold" />
          ) : (
            <X className="mr-1 h-3 w-3" weight="bold" />
          )}
          {verdictLabel}
        </span>
        {item.attempt && (
          <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
            {scorePct}%
          </span>
        )}
        {item.mistake && (
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--subject-french) 10%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--subject-french) 32%, transparent)",
              color: "var(--subject-french)",
            }}
          >
            <WarningCircle className="h-3 w-3" weight="bold" />
            {item.mistake.mistakeType.replace(/_/g, " ").toLowerCase()}
          </span>
        )}
      </div>

      {item.attempt && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="rounded-lg border border-border bg-surface-elevated/40 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Feedback
            </p>
            <div className="mt-1">
              <AIMarkdown
                id={`result-${item.itemId}-feedback`}
                content={item.attempt.feedback}
                density="compact"
              />
            </div>
          </div>
          <div className="rounded-lg border border-accent-border/40 bg-accent-subtle/30 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              Stronger answer
            </p>
            <div className="mt-1">
              <AIMarkdown
                id={`result-${item.itemId}-better`}
                content={item.attempt.betterAnswer}
                density="compact"
              />
            </div>
          </div>
        </div>
      )}
    </CockpitCard>
  );
}

function Skeleton() {
  return (
    <CockpitCard>
      <div className="flex items-center gap-5 py-3">
        <div className="h-28 w-28 animate-pulse rounded-2xl bg-muted/40" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-32 animate-pulse rounded bg-muted/30" />
          <div className="h-5 w-64 animate-pulse rounded bg-muted/40" />
          <div className="h-3 w-full max-w-md animate-pulse rounded bg-muted/30" />
        </div>
      </div>
    </CockpitCard>
  );
}

function NoGradeYet({ topicSlug }: { readonly topicSlug: string }) {
  return (
    <div className="flex flex-col gap-6">
      <CockpitCard>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-subject-french/15 text-subject-french"
            aria-hidden
          >
            <WarningCircle className="h-5 w-5" weight="duotone" />
          </span>
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            No graded run yet
          </h2>
          <p className="max-w-md text-[12.5px] text-muted-foreground">
            {`We could not find a graded run for "${topicSlug}". Start a practice run and finish it — the results page then surfaces per-item feedback and your German 1–6 letter grade.`}
          </p>
          <Link
            href={`/my-topics/${topicSlug}/practice`}
            className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            Start a practice
            <ArrowRight className="h-3.5 w-3.5" weight="bold" />
          </Link>
        </div>
      </CockpitCard>
    </div>
  );
}

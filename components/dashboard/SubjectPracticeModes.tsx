import Link from "next/link";

import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import {
  ArrowRight,
  Play,
  Target,
  BookOpenIcon,
  Cards,
} from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";

export interface SubjectPracticeRun {
  readonly id: string;
  readonly topicId: string;
  readonly topicSlug: string;
  readonly topicTitle: string;
  readonly chapterSlug: string;
  readonly status: "in_progress" | "graded" | "abandoned";
  readonly itemCount: number;
  readonly answeredCount: number;
  readonly overallScore: number | null;
  readonly topicConfidence: number | null;
  readonly grade: string | null;
  readonly startedAt: number;
  readonly completedAt: number | null;
  readonly mode: string | null;
  readonly skills: readonly string[];
}


const MODE_LABELS: Record<string, string> = {
  sequential: "Sequential",
  timed: "Timed",
  retry_wrong: "Retry wrong",
  exam_simulation: "Exam sim",
};

export function SubjectPracticeModes({
  runs,
  subjectSlug,
  subjectColor,
  nextBestChapterSlug,
  nextBestTopicSlug,
}: {
  readonly runs: readonly SubjectPracticeRun[];
  readonly subjectSlug: string;
  readonly subjectColor?: string;
  readonly nextBestChapterSlug?: string;
  readonly nextBestTopicSlug?: string;
}) {
  const fillVar = resolveColorVar(subjectColor);
  const gradedRuns = runs.filter((r) => r.status === "graded");
  const inProgress = runs.filter((r) => r.status === "in_progress");
  const bestRun = gradedRuns.length > 0
    ? gradedRuns.reduce((best, r) =>
        (r.overallScore ?? 0) > (best.overallScore ?? 0) ? r : best
      )
    : null;

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Practice"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {gradedRuns.length > 0
              ? `${gradedRuns.length} completed`
              : "Ready to start"}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {nextBestTopicSlug && nextBestChapterSlug && (
          <Link
            href={`/subjects/${subjectSlug}/${nextBestChapterSlug}/${nextBestTopicSlug}`}
            className="group rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors hover:border-accent/40 hover:bg-surface-elevated"
          >
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-md"
            style={{
              backgroundColor: `color-mix(in srgb, ${fillVar} 14%, transparent)`,
              color: fillVar,
            }}
          >
            <Target className="h-4 w-4" weight="duotone" />
          </span>
          <p className="mt-2.5 text-[13px] font-semibold tracking-tight text-foreground">
            Next recommended topic
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Start practicing what the system recommends next
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent group-hover:underline">
            Start studying
            <ArrowRight className="h-3 w-3" weight="bold" />
          </span>
        </Link>
        )}

        <Link
          href={`/subjects/${subjectSlug}#roadmap`}
          className="group rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors hover:border-accent/40 hover:bg-surface-elevated"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
            <BookOpenIcon className="h-4 w-4" weight="duotone" />
          </span>
          <p className="mt-2.5 text-[13px] font-semibold tracking-tight text-foreground">
            Pick a chapter
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Browse chapters and pick a topic to practice
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent group-hover:underline">
            Browse chapters
            <ArrowRight className="h-3 w-3" weight="bold" />
          </span>
        </Link>

        <Link
          href="/practice"
          className="group rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors hover:border-accent/40 hover:bg-surface-elevated"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
            <Target className="h-4 w-4" weight="duotone" />
          </span>
          <p className="mt-2.5 text-[13px] font-semibold tracking-tight text-foreground">
            Practice Arena
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Configure a custom practice session across topics
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent group-hover:underline">
            Open arena
            <ArrowRight className="h-3 w-3" weight="bold" />
          </span>
        </Link>

        <Link
          href={`/tutor?subject=${subjectSlug}`}
          className="group rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors hover:border-accent/40 hover:bg-surface-elevated"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
            <Cards className="h-4 w-4" weight="duotone" />
          </span>
          <p className="mt-2.5 text-[13px] font-semibold tracking-tight text-foreground">
            Ask the tutor
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Generate practice questions inline with AI
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent group-hover:underline">
            Open tutor
            <ArrowRight className="h-3 w-3" weight="bold" />
          </span>
        </Link>
      </div>

      {inProgress.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
            In progress
          </p>
          <div className="flex flex-col gap-2">
            {inProgress.slice(0, 3).map((run) => (
              <Link
                key={run.id}
                href={`/subjects/${subjectSlug}/${run.chapterSlug}/${run.topicSlug}/practice?runId=${run.id}`}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] transition-colors hover:bg-surface"
              >
                <Play className="h-3.5 w-3.5 shrink-0 text-accent" weight="fill" />
                <span className="font-medium text-foreground">
                  {run.topicTitle}
                </span>
                <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                  {run.answeredCount}/{run.itemCount}
                </span>
                <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" weight="bold" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {bestRun && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
            Best result
          </p>
          <div className="flex items-center gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold tabular-nums"
              style={{
                backgroundColor: `color-mix(in srgb, ${fillVar} 14%, transparent)`,
                color: fillVar,
              }}
            >
              {bestRun.grade ?? "—"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-foreground">
                {bestRun.topicTitle}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {bestRun.mode ? MODE_LABELS[bestRun.mode] ?? bestRun.mode : "Practice"}
                {" "}·{" "}
                {bestRun.overallScore !== null
                  ? `${Math.round(bestRun.overallScore * 100)}%`
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}
    </CockpitCard>
  );
}

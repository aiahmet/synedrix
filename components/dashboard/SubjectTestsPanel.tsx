import Link from "next/link";

import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import {
  Clipboard,
  Play,
  ArrowRight,
  GitFork,
} from "@/components/landing/icons";
import { formatRelativeDate } from "@/lib/format/relativeDate";

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

const GRADE_DESCRIPTIONS: Record<string, string> = {
  "1": "Sehr gut",
  "2": "Gut",
  "3": "Befriedigend",
  "4": "Ausreichend",
  "5": "Mangelhaft",
  "6": "Ungenügend",
};

export function SubjectTestsPanel({
  runs,
  subjectSlug,
}: {
  readonly runs: readonly SubjectPracticeRun[];
  readonly subjectSlug: string;
}) {
  const gradedRuns = runs.filter((r) => r.status === "graded" && r.overallScore !== null);
  const inProgressRuns = runs.filter((r) => r.status === "in_progress");

  if (runs.length === 0) {
    return (
      <CockpitCard>
        <CockpitCardHeader label="Tests &amp; mocks" />
        <div className="flex items-start gap-3">
          <Clipboard
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
            weight="duotone"
          />
          <div>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              No practice runs completed yet in this subject. Complete a
              topic practice session to see your results here.
            </p>
            <p className="mt-2 text-[11.5px] text-muted-foreground">
              Results are grouped by topic and show your grade, score, and
              areas to improve — broken down by skill rather than a single
              number.
            </p>
          </div>
        </div>
      </CockpitCard>
    );
  }

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Tests &amp; mocks"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {gradedRuns.length} graded
            {inProgressRuns.length > 0 ? ` · ${inProgressRuns.length} active` : ""}
          </span>
        }
      />

      {inProgressRuns.length > 0 && (
        <div className="mb-4 flex flex-col gap-1.5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            In progress
          </p>
          {inProgressRuns.slice(0, 3).map((run) => (
            <Link
              key={run.id}
              href={`/subjects/${subjectSlug}/${run.chapterSlug}/${run.topicSlug}/practice?runId=${run.id}`}
              className="flex items-center gap-2.5 rounded-md border border-accent/30 bg-accent/[0.04] px-3 py-2 text-[12px] transition-colors hover:bg-accent/[0.08]"
            >
              <Play className="h-3.5 w-3.5 shrink-0 text-accent" weight="fill" />
              <span className="font-medium text-foreground">
                {run.topicTitle}
              </span>
              <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {run.answeredCount}/{run.itemCount}
              </span>
              <ArrowRight className="ml-auto h-3 w-3 text-accent" weight="bold" />
            </Link>
          ))}
        </div>
      )}

      {gradedRuns.length > 0 && (
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2.5">
            Completed
          </p>
          <div className="flex flex-col gap-2">
            {gradedRuns.slice(0, 10).map((run) => (
              <TestResultRow
                key={run.id}
                run={run}
                subjectSlug={subjectSlug}
              />
            ))}
          </div>
        </div>
      )}

      {gradedRuns.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2.5">
            Grade distribution
          </p>
          <GradeDistribution runs={gradedRuns} />
        </div>
      )}
    </CockpitCard>
  );
}

function TestResultRow({
  run,
  subjectSlug,
}: {
  readonly run: SubjectPracticeRun;
  readonly subjectSlug: string;
}) {
  const scorePct =
    run.overallScore !== null ? Math.round(run.overallScore * 100) : null;
  const gradeLabel =
    run.grade !== null
      ? `${run.grade} — ${GRADE_DESCRIPTIONS[run.grade] ?? ""}`
      : null;
  const href = `/subjects/${subjectSlug}/${run.chapterSlug}/${run.topicSlug}`;

  const scoreColor =
    scorePct !== null
      ? scorePct >= 85
        ? "var(--accent)"
        : scorePct >= 50
          ? "var(--subject-english)"
          : "var(--subject-french)"
      : "var(--muted-foreground)";

  const confidencePct =
    run.topicConfidence !== null
      ? Math.round(run.topicConfidence * 100)
      : null;
  const delta =
    scorePct !== null && confidencePct !== null
      ? scorePct - confidencePct
      : null;
  const hasComparison = delta !== null;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md border border-border/60 bg-background px-3 py-2.5 transition-colors hover:bg-surface"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-bold tabular-nums"
        style={{
          backgroundColor: `color-mix(in srgb, ${scoreColor} 12%, transparent)`,
          color: scoreColor,
        }}
      >
        {run.grade ?? "—"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-foreground">
          {run.topicTitle}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {gradeLabel && (
            <span className="text-[11px] text-muted-foreground">
              {gradeLabel}
            </span>
          )}
          {scorePct !== null && (
            <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
              {scorePct}%
            </span>
          )}
          {hasComparison && delta !== null && (
            <span
              className="font-mono text-[10.5px] tabular-nums"
              style={{
                color:
                  delta > 0
                    ? "var(--accent)"
                    : delta < 0
                      ? "var(--subject-french)"
                      : "var(--muted-foreground)",
              }}
            >
              {delta > 0 ? "↑" : delta < 0 ? "↓" : "="}
              {Math.abs(delta)}% vs. confidence
            </span>
          )}
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {run.mode ?? "standard"}
          </span>
          {run.completedAt !== null && (
            <span className="text-[11px] text-muted-foreground">
              {formatRelativeDate(run.completedAt)}
            </span>
          )}
        </div>
        {run.skills.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {run.skills.slice(0, 4).map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full border border-border/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground"
              >
                <GitFork className="h-2 w-2" weight="bold" />
                {skill}
              </span>
            ))}
            {run.skills.length > 4 && (
              <span className="font-mono text-[9px] tabular-nums text-muted-foreground">
                +{run.skills.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" weight="bold" />
    </Link>
  );
}

function GradeDistribution({
  runs,
}: {
  readonly runs: readonly SubjectPracticeRun[];
}) {
  const counts: Record<string, number> = {};
  for (const r of runs) {
    if (r.grade !== null) {
      counts[r.grade] = (counts[r.grade] ?? 0) + 1;
    }
  }

  const grades = ["1", "2", "3", "4", "5", "6"];
  const max = Math.max(1, ...Object.values(counts));

  return (
    <div className="flex items-end gap-1.5 h-16">
      {grades.map((g) => {
        const count = counts[g] ?? 0;
        const height = Math.max(4, Math.round((count / max) * 100));
        return (
          <div
            key={g}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <span className="font-mono text-[9.5px] tabular-nums text-muted-foreground">
              {count}
            </span>
            <div
              className="w-full rounded-t-sm transition-[height] duration-300"
              style={{
                height: `${height}%`,
                backgroundColor:
                  g === "1" || g === "2"
                    ? "var(--accent)"
                    : g === "3" || g === "4"
                      ? "var(--subject-english)"
                      : "var(--subject-french)",
              }}
            />
            <span className="font-mono text-[9.5px] tabular-nums text-muted-foreground">
              {g}
            </span>
          </div>
        );
      })}
    </div>
  );
}

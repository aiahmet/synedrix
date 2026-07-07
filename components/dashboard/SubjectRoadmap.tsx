import Link from "next/link";

import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { MasteryRing } from "./MasteryRing";
import {
  ArrowRight,
  Check,
  LockSimple,
  Sparkle,
  Stack,
  SubjectGlyph,
  GitBranch,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { resolveColorVar } from "@/lib/utils/subjectColor";

export interface RoadmapChapter {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly order: number;
  readonly topicCount: number;
  readonly topicsStudied: number;
  readonly mastery: number;
  readonly lastStudiedAt: number | null;
  readonly isCurrent: boolean;
  readonly isCompleted: boolean;
  readonly topics: readonly RoadmapTopic[];
}

export interface RoadmapTopic {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly objectives: readonly string[];
  readonly examRelevance: number;
  readonly difficulty: "EASY" | "MEDIUM" | "HARD";
  readonly estimatedMinutes?: number;
  readonly mastery: number;
  readonly confidence: number;
  readonly lastStudiedAt: number | null;
  readonly isStudied: boolean;
  readonly source: "canonical" | "user";
  readonly prerequisites: readonly RoadmapPrerequisite[];
  readonly isUnlocked: boolean;
}

export interface RoadmapPrerequisite {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly chapterSlug: string;
  readonly subjectSlug: string;
  readonly mastery: number;
  readonly isStudied: boolean;
  readonly unlocked: boolean;
}

export function SubjectRoadmap({
  chapters,
  subjectSlug,
  subjectColor,
  subjectIcon,
}: {
  readonly chapters: readonly RoadmapChapter[];
  readonly subjectSlug: string;
  readonly subjectColor?: string;
  readonly subjectIcon?: string;
}) {
  if (chapters.length === 0) {
    return (
      <CockpitCard>
        <div className="flex flex-col items-center gap-1 py-6 text-center">
          <p className="text-[13.5px] font-medium text-foreground">
            No chapters indexed yet.
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            The curriculum is still being authored for this subject.
          </p>
        </div>
      </CockpitCard>
    );
  }

  const fillVar = resolveColorVar(subjectColor);
  const currentChapter = chapters.find((ch) => ch.isCurrent);
  const totalChapters = chapters.length;
  const completedChapters = chapters.filter((ch) => ch.isCompleted).length;
  const gradeTargetLabel = totalChapters > 0
    ? `${totalChapters} chapters to Abitur-ready · ${completedChapters} mastered`
    : null;

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Roadmap"
        trailing={
          <div className="flex items-center gap-2">
            <SubjectGlyph
              icon={subjectIcon}
              className="h-3 w-3"
              fillVar={fillVar}
            />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              Grade 12 target
            </span>
          </div>
        }
      />

      {gradeTargetLabel && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
          <GitBranch
            className="h-4 w-4 shrink-0 text-muted-foreground"
            weight="duotone"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium text-foreground">
              {gradeTargetLabel}
            </p>
            {currentChapter && (
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                You are in: {currentChapter.title}
              </p>
            )}
          </div>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0}%`,
                backgroundColor: fillVar,
              }}
            />
          </div>
          <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {totalChapters > 0
              ? Math.round((completedChapters / totalChapters) * 100)
              : 0}
            %
          </span>
        </div>
      )}

      <ol className="relative flex flex-col gap-6 pl-6 sm:pl-7">
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-4 left-2.5 top-4 w-px sm:left-3"
          style={{
            backgroundColor: `color-mix(in srgb, ${fillVar} 24%, var(--border))`,
          }}
        />
        {chapters.map((ch) => (
          <RoadmapChapterNode
            key={ch.id}
            chapter={ch}
            subjectSlug={subjectSlug}
            fillVar={fillVar}
          />
        ))}
      </ol>
    </CockpitCard>
  );
}

function RoadmapChapterNode({
  chapter,
  subjectSlug,
  fillVar,
}: {
  readonly chapter: RoadmapChapter;
  readonly subjectSlug: string;
  readonly fillVar: string;
}) {
  const isEmpty = chapter.topicsStudied === 0;
  const isLocked = isEmpty && !chapter.isCurrent && !chapter.isCompleted;
  const status =
    chapter.isCompleted
      ? "Completed"
      : chapter.isCurrent
        ? "You are here"
        : isEmpty
          ? "Locked"
          : "In progress";
  const href = `/subjects/${subjectSlug}/${chapter.slug}`;

  return (
    <li className="relative">
      <span
        aria-hidden
        className={cn(
          "absolute -left-6 top-3.5 flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-mono font-semibold tabular-nums sm:-left-7",
          chapter.isCompleted
            ? "border-accent bg-background text-accent"
            : chapter.isCurrent
              ? "border bg-background"
              : "border-border bg-background text-muted-foreground",
        )}
        style={
          chapter.isCurrent
            ? { borderColor: fillVar, color: fillVar }
            : undefined
        }
      >
        {chapter.isCompleted ? (
          <Check className="h-2.5 w-2.5" weight="bold" />
        ) : isLocked ? (
          <LockSimple className="h-2.5 w-2.5" weight="bold" />
        ) : (
          String(chapter.order).padStart(2, "0")
        )}
      </span>

      <div
        className={cn(
          "rounded-lg border px-4 py-3.5",
          chapter.isCurrent
            ? "border-accent/50 bg-surface"
            : "border-border bg-background",
          isLocked && "opacity-70",
        )}
        style={
          chapter.isCurrent
            ? {
                borderColor: `color-mix(in srgb, ${fillVar} 40%, var(--border))`,
              }
            : undefined
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
                {chapter.title}
              </h3>
              <span
                className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em]"
                style={{
                  color: chapter.isCurrent
                    ? fillVar
                    : chapter.isCompleted
                      ? "var(--accent)"
                      : "var(--muted-foreground)",
                }}
              >
                {status}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.max(2, Math.round(chapter.mastery * 100))}%`,
                    backgroundColor: fillVar,
                  }}
                />
              </div>
              <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {Math.round(chapter.mastery * 100)}%
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Stack className="h-3 w-3" weight="duotone" />
                {chapter.topicsStudied} of {chapter.topicCount} topics
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <MasteryRing
              value={chapter.mastery}
              size={36}
              strokeWidth={3.5}
              label={`${Math.round(chapter.mastery * 100)}%`}
              ariaLabel={`Chapter mastery ${Math.round(chapter.mastery * 100)} percent`}
              colorVar={fillVar}
            />
            <Link
              href={href}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md px-3 text-[11.5px] font-medium transition-colors",
                chapter.isCurrent
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "border border-border bg-background text-muted-foreground hover:border-accent/60 hover:text-foreground",
              )}
            >
              {chapter.isCurrent ? (
                <>
                  <Sparkle className="h-3 w-3" weight="duotone" />
                  Continue
                </>
              ) : (
                <>
                  {chapter.isCompleted ? "Review" : "Open"}
                  <ArrowRight className="h-3 w-3" weight="bold" />
                </>
              )}
            </Link>
          </div>
        </div>

        {chapter.topics.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {chapter.topics.slice(0, 12).map((topic) => (
                <TopicPill
                  key={topic.id}
                  topic={topic}
                  subjectSlug={subjectSlug}
                  chapterSlug={chapter.slug}
                  fillVar={fillVar}
                />
              ))}
            </div>
            {chapter.topics.length > 12 && (
              <Link
                href={href}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                +{chapter.topics.length - 12} more topics
                <ArrowRight className="h-2.5 w-2.5" weight="bold" />
              </Link>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function TopicPill({
  topic,
  subjectSlug,
  chapterSlug,
  fillVar,
}: {
  readonly topic: RoadmapTopic;
  readonly subjectSlug: string;
  readonly chapterSlug: string;
  readonly fillVar: string;
}) {
  const href = `/subjects/${subjectSlug}/${chapterSlug}/${topic.slug}`;
  const lockedCount = topic.prerequisites.filter((p) => !p.unlocked).length;

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] transition-colors hover:bg-surface",
        !topic.isUnlocked && "opacity-60",
      )}
    >
      {!topic.isUnlocked ? (
        <LockSimple className="h-3 w-3 shrink-0 text-muted-foreground" weight="bold" />
      ) : topic.mastery >= 0.85 ? (
        <Check className="h-3 w-3 shrink-0 text-accent" weight="bold" />
      ) : topic.isStudied ? (
        <span
          className="block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: fillVar }}
        />
      ) : (
        <span className="block h-2 w-2 shrink-0 rounded-full border border-border" />
      )}
      <span className="line-clamp-1 font-medium text-foreground">
        {topic.title}
      </span>
      {lockedCount > 0 && (
        <span className="ml-auto shrink-0 font-mono text-[9.5px] tabular-nums text-muted-foreground">
          {lockedCount} req
        </span>
      )}
    </Link>
  );
}

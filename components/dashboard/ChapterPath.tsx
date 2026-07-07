import Link from "next/link";

import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { LegendTooltip } from "./LegendTooltip";
import { MasteryRing } from "./MasteryRing";
import {
  ArrowRight,
  Check,
  LockSimple,
  Sparkle,
  Stack,
  SubjectGlyph,
  Timer,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { formatRelativeDate } from "@/lib/format/relativeDate";
import { resolveColorVar } from "@/lib/utils/subjectColor";

/**
 * A single chapter row in the subject page path.
 */
export interface ChapterPathEntry {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly order: number;
  readonly topicCount: number;
  readonly topicsStudied: number;
  readonly mastery: number;
  readonly lastStudiedAt: number | null;
  readonly firstTopic: {
    readonly slug: string;
    readonly mastery: number;
  } | null;
  readonly isCurrent: boolean;
  readonly isCompleted: boolean;
}

/**
 * ChapterPath.
 *
 * Plan §2.2: a vertical timeline of the subject's chapters,
 * replacing the flat `ChapterList` on the subject page. The
 * visual is "a path", not "a list": a vertical line connects
 * numbered nodes, the current chapter is visually distinct
 * (elevated, accent border, "Current" eyebrow), future chapters
 * are dimmed, completed chapters get a check icon.
 *
 * Per `docs/SYNEDRIX-FRONTEND-STYLE.md`:
 *
 *   - **Single-layer card.** The chapter rows were previously
 *     triple-nested (`CockpitCard > ChapterNode card > inner
 *     content`). Each row is now a flat, single-layer row with
 *     a hairline border — the rulebook's "lists are typography"
 *     pattern (§1). Row spacing is uniform via `gap-2` on the
 *     `<ol>`.
 *
 *   - **No icon container.** The status icon (number / check /
 *     lock) sits on the timeline at native size, in the
 *     per-subject hue when "current". No `bg-color-mix(...)`
 *     container.
 *
 *   - **No pill chips.** The "Current" / "Completed" / "In
 *     progress" / "Locked" status is rendered as plain
 *     uppercase muted text, not a pill chip (§1).
 *
 *   - **No bouncy CTA.** Buttons don't bounce.
 *
 * The component does NOT decide which chapter is current — the
 * parent (`SubjectDetailClient`) passes `isCurrent` and
 * `isCompleted` per row. Keeping the `isCurrent` flag out of
 * this component means the path itself stays a pure renderer.
 */
export function ChapterPath({
  chapters,
  subjectSlug,
  subjectColor,
  subjectIcon,
}: {
  readonly chapters: readonly ChapterPathEntry[];
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

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Curriculum path"
        trailing={
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground"
            >
              <SubjectGlyph
                icon={subjectIcon}
                className="h-3 w-3"
                fillVar={fillVar}
              />
              {chapters.length} chapters
            </span>
            <LegendTooltip />
          </div>
        }
      />
      <ol className="relative flex flex-col gap-2 pl-7 sm:pl-9">
        {/* Vertical connector line. The line ends ~16px
            from the bottom so the final node has the same
            "endpoint" feel as the others. */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-4 left-3 top-4 w-px sm:left-4"
          style={{
            backgroundColor: `color-mix(in srgb, ${fillVar} 24%, var(--border))`,
          }}
        />
        {chapters.map((ch) => (
          <ChapterNode
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

function ChapterNode({
  chapter,
  subjectSlug,
  fillVar,
}: {
  readonly chapter: ChapterPathEntry;
  readonly subjectSlug: string;
  readonly fillVar: string;
}) {
  const isEmpty = chapter.topicsStudied === 0;
  const isLocked = isEmpty && !chapter.isCurrent && !chapter.isCompleted;
  const href = `/subjects/${subjectSlug}/${chapter.slug}`;
  const status =
    chapter.isCompleted
      ? "Completed"
      : chapter.isCurrent
        ? "Current"
        : isEmpty
          ? "Locked"
          : "In progress";
  const lastStudiedLabel = chapter.lastStudiedAt
    ? formatRelativeDate(chapter.lastStudiedAt)
    : "Not started";

  return (
    <li className="relative">
      {/* Timeline node. Plain bordered circle at native size.
          The "current" node's color is the per-subject hue;
          "completed" gets a check; "locked" gets a lock.
          No bg-color-mix container. */}
      <span
        aria-hidden
        className={cn(
          "absolute -left-7 top-3.5 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-mono font-semibold tabular-nums sm:-left-9",
          chapter.isCompleted
            ? "border-accent text-accent"
            : chapter.isCurrent
              ? "border bg-background text-foreground"
              : "border-border bg-background text-muted-foreground",
        )}
        style={
          chapter.isCurrent
            ? { borderColor: fillVar, color: fillVar }
            : undefined
        }
      >
        {chapter.isCompleted ? (
          <Check className="h-3 w-3" weight="bold" />
        ) : isLocked ? (
          <LockSimple className="h-3 w-3" weight="bold" />
        ) : (
          String(chapter.order).padStart(2, "0")
        )}
      </span>

      <Link
        href={href}
        className={cn(
          "group/row flex flex-col gap-3 rounded-lg border border-border px-4 py-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4",
          chapter.isCurrent
            ? "hover:border-accent/60"
            : "hover:border-accent/40",
          isLocked && "opacity-70",
        )}
        style={
          chapter.isCurrent
            ? {
                borderColor: `color-mix(in srgb, ${fillVar} 50%, var(--border))`,
              }
            : undefined
        }
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
              {chapter.title}
            </h3>
            {/* Status as plain uppercase muted text. No pill. */}
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
            <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
              Ch. {String(chapter.order).padStart(2, "0")}
            </span>
          </div>
          {chapter.description && (
            <p className="mt-1 line-clamp-1 text-[12px] leading-relaxed text-muted-foreground">
              {chapter.description}
            </p>
          )}
          <div className="mt-2.5 flex items-center gap-3">
            <div className="h-1.5 w-full max-w-[14rem] overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.max(2, Math.round(chapter.mastery * 100))}%`,
                  backgroundColor: fillVar,
                }}
              />
            </div>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {Math.round(chapter.mastery * 100)}%
            </span>
            <span className="ml-1 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
              <Stack className="h-3 w-3" weight="duotone" />
              {chapter.topicsStudied} of {chapter.topicCount} topics
            </span>
            {!isEmpty && (
              <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
                <Timer className="h-3 w-3" weight="duotone" />
                {lastStudiedLabel}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <MasteryRing
            value={chapter.mastery}
            size={40}
            strokeWidth={4}
            label={`${Math.round(chapter.mastery * 100)}%`}
            ariaLabel={`Chapter mastery ${Math.round(chapter.mastery * 100)} percent`}
            colorVar={fillVar}
          />
          <span
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-md px-3 text-[11.5px] font-medium transition-colors",
              chapter.isCurrent
                ? "bg-foreground text-background"
                : "border border-border bg-background text-muted-foreground group-hover/row:border-accent/60 group-hover/row:text-foreground",
            )}
          >
            {chapter.isCurrent ? (
              <>
                <Sparkle className="h-3 w-3" weight="duotone" />
                Continue
              </>
            ) : chapter.isCompleted ? (
              <>
                Review
                <ArrowRight className="h-3 w-3" weight="bold" />
              </>
            ) : isEmpty ? (
              <>
                Open
                <ArrowRight className="h-3 w-3" weight="bold" />
              </>
            ) : (
              <>
                Resume
                <ArrowRight className="h-3 w-3" weight="bold" />
              </>
            )}
          </span>
        </div>
      </Link>
    </li>
  );
}

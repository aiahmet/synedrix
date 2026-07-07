import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { MasteryRing } from "./MasteryRing";
import {
  CalendarBlank,
  CheckCircle,
  Stack,
} from "@/components/landing/icons";
import { formatRelativeDate } from "@/lib/format/relativeDate";

/**
 * SubjectDetailStats.
 *
 * Three-up row of subject-level signals: mastery ring, topics
 * progress (studied / total), and last studied date. Per
 * `docs/SYNEDRIX-FRONTEND-STYLE.md`:
 *
 *   - **No icon container.** The previous
 *     `bg-accent/10 ring-1 ring-accent/10` boxes around the
 *     `CheckCircle` and `CalendarBlank` icons are removed
 *     (§8: "Never wrap an icon in `bg-accent/10 ring-1
 *     ring-accent/10`. Just render it at native size and
 *     color").
 *
 *   - **No bouncy CTA.** The "Continue the loop" link
 *     (the tail of each stat cell) drops the scale
 *     interaction and reads as quiet typography.
 *
 * The layout is identical to the dashboard's `CockpitStatsRow`
 * so the user reads the same instrument language on both pages.
 */
export function SubjectDetailStats({
  mastery,
  topicsStudied,
  topicCount,
  lastStudiedAt,
}: {
  readonly mastery: number;
  readonly topicsStudied: number;
  readonly topicCount: number;
  readonly lastStudiedAt: number | null;
}) {
  const masteryPct = Math.round(mastery * 100);
  const lastLabel = lastStudiedAt
    ? formatRelativeDate(lastStudiedAt)
    : "Not yet";
  const progressPct =
    topicCount > 0 ? Math.round((topicsStudied / topicCount) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <CockpitCard>
        <CockpitCardHeader label="Mastery" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[34px] font-semibold leading-none tracking-[-0.02em] text-foreground">
              {masteryPct}
              <span className="ml-0.5 text-[18px] font-medium text-muted-foreground">
                %
              </span>
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {masteryPct === 0
                ? "Across every topic in this subject."
                : masteryPct < 40
                  ? "Early. Every topic lifts the curve."
                  : masteryPct < 70
                    ? "On the climb. Stay in the loop."
                    : "Strong. The loop is paying off."}
            </p>
          </div>
          <MasteryRing
            value={mastery}
            label={`${masteryPct}%`}
            ariaLabel={`Subject mastery: ${masteryPct} percent`}
          />
        </div>
      </CockpitCard>

      <CockpitCard>
        <CockpitCardHeader label="Topics touched" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-[34px] font-semibold leading-none tracking-[-0.02em] text-foreground">
                {topicsStudied}
              </p>
              <span className="text-[18px] font-medium text-muted-foreground">
                / {topicCount}
              </span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {topicsStudied === 0
                ? "Nothing started yet. Pick the first chapter."
                : `${progressPct}% of the curriculum indexed.`}
            </p>
            <p className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-accent">
              <Stack className="h-3 w-3" weight="duotone" />
              {progressPct}% complete
            </p>
          </div>
          {/* Icon at native size, no container. */}
          <CheckCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-accent"
            weight="duotone"
            aria-hidden
          />
        </div>
      </CockpitCard>

      <CockpitCard>
        <CockpitCardHeader label="Last studied" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-foreground">
              {lastLabel}
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {lastStudiedAt
                ? "Most recent progress on any topic in this subject."
                : "Start a session to set the clock."}
            </p>
            <p className="mt-3 text-[12px] font-medium text-accent">
              Continue the loop
            </p>
          </div>
          {/* Icon at native size, no container. The previous
              `bg-accent/10 ring-1 ring-accent/10` box is gone. */}
          <CalendarBlank
            className="mt-0.5 h-5 w-5 shrink-0 text-accent"
            weight="duotone"
            aria-hidden
          />
        </div>
      </CockpitCard>
    </div>
  );
}

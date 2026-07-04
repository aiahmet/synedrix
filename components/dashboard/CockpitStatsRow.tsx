import Link from "next/link";

import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { MasteryRing } from "./MasteryRing";
import {
  CheckCircle,
  Flame,
  Sparkle,
} from "@/components/landing/icons";

/**
 * CockpitStatsRow.
 *
 * Three-up instrument row that sits directly under the page header.
 * Each card is a CockpitCard with a single primary metric, an
 * iconographic label, and a one-line supporting sentence.
 *
 * - "Due today"   : review queue items whose dueAt has passed.
 * - "Streak"      : consecutive-day study streak. 0 is a call to
 *                   action, not a failure.
 * - "Mastery"     : overall mastery (mean across touched topics),
 *                   shown as a ring so the visual scales gracefully
 *                   from 0% to 100%.
 */
export function CockpitStatsRow({
  dueToday,
  streakDays,
  overallMastery,
}: {
  readonly dueToday: number;
  readonly streakDays: number;
  readonly overallMastery: number;
}) {
  const masteryPct = Math.round(overallMastery * 100);
  const streakIsHot = streakDays >= 3;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <CockpitCard className="sm:col-span-1">
        <CockpitCardHeader label="Due today" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[34px] font-semibold leading-none tracking-[-0.02em] text-foreground">
              {dueToday}
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {dueToday === 0
                ? "Nothing due. Add a deck or revisit a topic."
                : `Cards and topics ready to revisit.`}
            </p>
            <Link
              href="/subjects"
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-accent transition-colors hover:text-accent/80"
            >
              {dueToday > 0 ? "Pick a topic" : "Browse subjects"}
            </Link>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/10">
            <CheckCircle className="h-[1.05rem] w-[1.05rem] text-accent" weight="duotone" />
          </span>
        </div>
      </CockpitCard>

      <CockpitCard className="sm:col-span-1">
        <CockpitCardHeader label="Streak" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-[34px] font-semibold leading-none tracking-[-0.02em] text-foreground">
                {streakDays}
              </p>
              <span className="text-[12.5px] font-medium text-muted-foreground">
                {streakDays === 1 ? "day" : "days"}
              </span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {streakDays === 0
                ? "Start a session to begin your first streak."
                : streakIsHot
                  ? "Compounding. Keep the loop unbroken."
                  : "Solid. Tomorrow locks it in."}
            </p>
            <Link
              href="/subjects"
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-accent transition-colors hover:text-accent/80"
            >
              {streakDays === 0 ? "Start a session" : "Keep going"}
              <Flame className="h-3 w-3" weight={streakIsHot ? "fill" : "bold"} />
            </Link>
          </div>
          <span
            className={
              "flex h-9 w-9 items-center justify-center rounded-lg ring-1 " +
              (streakIsHot
                ? "bg-accent/15 ring-accent/20"
                : "bg-surface-elevated ring-border")
            }
          >
            <Flame
              className={
                "h-[1.05rem] w-[1.05rem] " +
                (streakIsHot ? "text-accent" : "text-muted-foreground")
              }
              weight={streakIsHot ? "fill" : "duotone"}
            />
          </span>
        </div>
      </CockpitCard>

      <CockpitCard className="sm:col-span-1">
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
                ? "Across every topic you have touched."
                : masteryPct < 40
                  ? "Early. Every session lifts the curve."
                  : masteryPct < 70
                    ? "On the climb. The review queue carries you."
                    : "Strong. The loop is paying off."}
            </p>
            <Link
              href="/subjects"
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-accent transition-colors hover:text-accent/80"
            >
              Browse subjects
              <Sparkle className="h-3 w-3" weight="bold" />
            </Link>
          </div>
          <MasteryRing
            value={overallMastery}
            label={`${masteryPct}%`}
            ariaLabel={`Overall mastery: ${masteryPct} percent`}
          />
        </div>
      </CockpitCard>
    </div>
  );
}

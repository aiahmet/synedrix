"use client";

import { useMemo } from "react";
import { Preloaded, usePreloadedQuery } from "convex/react";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import { CockpitStatsRow } from "@/components/dashboard/CockpitStatsRow";
import { SubjectMasteryStrip } from "@/components/dashboard/SubjectMasteryStrip";
import { EmptySubjectsState } from "@/components/dashboard/EmptySubjectsState";
import { ContinueStudyingCard } from "@/components/dashboard/ContinueStudyingCard";
import { RecentActivityStrip } from "@/components/dashboard/RecentActivityStrip";
import { WhatsNewStrip } from "@/components/dashboard/WhatsNewStrip";
import { AskTutorCta } from "@/components/dashboard/AskTutorCta";
import { ArrowRight, Target, UserCircle } from "@/components/landing/icons";

/**
 * DashboardOverviewClient.
 *
 * The only client island on the dashboard page.
 * Subscribes to the preloaded Convex queries and
 * composes the cockpit:
 *
 *   1. ContinueStudyingCard (plan §1.1) — the single
 *      most important "next action" on the page.
 *      Rendered above the stats row when the user has
 *      any progress; hidden when fresh sign-up.
 *   2. CockpitStatsRow — three primary signals.
 *   3. SubjectMasteryStrip — per-subject mastery rows.
 *   4. "View your topics" link (plan §3.4) — shown
 *      only when the user has authored at least one
 *      topic.
 *   5. RecentActivityStrip (plan §3.2) — last 5 user
 *      actions.
 *   6. WhatsNewStrip (plan §4.4) — recent AI-driven
 *      curriculum updates.
 *
 * The cockpit stays a single design system because
 * every child component is a server-renderable
 * primitive; only the data subscription crosses the
 * client boundary.
 */
export function DashboardOverviewClient({
  preloaded,
  subjectsPreloaded,
  continuePreloaded,
  recentActivityPreloaded,
  whatsNewPreloaded,
  ownedTopicsPreloaded,
  fallbackName,
}: {
  readonly preloaded: Preloaded<typeof api.dashboard.getOverview>;
  readonly subjectsPreloaded: Preloaded<typeof api.subjects.list>;
  readonly continuePreloaded: Preloaded<
    typeof api.dashboard.getContinueStudying
  >;
  readonly recentActivityPreloaded: Preloaded<
    typeof api.dashboard.getRecentActivity
  >;
  readonly whatsNewPreloaded: Preloaded<
    typeof api.telemetry.getRecentSystemUpdates
  >;
  readonly ownedTopicsPreloaded: Preloaded<
    typeof api.dashboard.listOwnedTopicsForCurrentUser
  >;
  readonly fallbackName: string;
}) {
  const data = usePreloadedQuery(preloaded);
  const subjects = usePreloadedQuery(subjectsPreloaded);
  const continueData = usePreloadedQuery(continuePreloaded);
  const recentActivity = usePreloadedQuery(recentActivityPreloaded);
  const whatsNew = usePreloadedQuery(whatsNewPreloaded);
  const ownedTopics = usePreloadedQuery(ownedTopicsPreloaded);

  // Map the canonical subjects shape into the lighter
  // shape `EmptySubjectsState` needs (id, slug, title,
  // color, icon, enrolled, topicCount). Memoised on the
  // `subjects` array reference so Convex's reactive
  // re-render after an enroll click does not re-allocate
  // a fresh array on every parent tick.
  const pickableSubjects = useMemo(
    () =>
      subjects.map((s) => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        color: s.color,
        icon: s.icon,
        enrolled: s.enrolled,
        topicCount: s.topicCount,
      })),
    [subjects]
  );

  // Plan §1.1: the "Chat with tutor" dashboard CTA
  // targets the user's most recently studied subject
  // (preferred — the user clearly has a topic in
  // mind) and falls back to the highest-mastery
  // subject in the cockpit when no progress exists
  // yet. `null` when the user has no subjects
  // enrolled — the empty cockpit state already
  // explains that and the CTA would be a dead end.
  const primarySubjectForTutor = useMemo(() => {
    if (continueData) {
      return {
        slug: continueData.subject.slug,
        title: continueData.subject.title,
        color: continueData.subject.color,
      };
    }
    if (data.subjects.length === 0) return null;
    // The cockpit already sorts `data.subjects` by
    // mastery desc, so the first row is the strongest
    // signal. Fall back to the first pickable
    // canonical subject when the cockpit is empty
    // (enrolled subjects list is empty but subjects
    // are pickable — possible during the legacy
    // progress-no-enrollment branch).
    const top = data.subjects[0] ?? pickableSubjects[0];
    if (!top) return null;
    return { slug: top.slug, title: top.title, color: top.color };
  }, [continueData, data.subjects, pickableSubjects]);

  if (data.isEmpty) {
    return (
      <EmptySubjectsState
        userName={data.user?.name ?? fallbackName}
        availableSubjects={pickableSubjects}
      />
    );
  }

  return (
    <>
      {continueData && (
        <ContinueStudyingCard data={continueData} />
      )}
      <CockpitStatsRow
        dueToday={data.stats.dueToday}
        streakDays={data.stats.streakDays}
        overallMastery={data.stats.overallMastery}
      />
      <SubjectMasteryStrip subjects={data.subjects} />
      {/* Plan §1.1: a prominent "Chat with tutor"
          CTA on the dashboard. Renders an
          `AskTutorCta` for the user's most-recent
          subject (resolved from `continueData` when
          available, else the highest-mastery subject
          in the cockpit) so the user can drop into a
          tutor thread from the home screen. The CTA
          itself is the same composer used on the
          topic page — the URL `?from=/dashboard` is
          appended by `AskTutorCta` so the tutor's
          "Back" link routes here. */}
      <Link
        href="/practice"
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-accent-border/40 bg-accent-subtle/20 px-3.5 text-[12px] font-medium text-accent transition-colors hover:border-accent-border/60 hover:bg-accent-subtle/30"
      >
        <Target className="h-3.5 w-3.5" weight="duotone" />
        Practice Arena
        <ArrowRight className="h-3 w-3" weight="bold" />
      </Link>
      {primarySubjectForTutor && (
        <AskTutorCta
          subject={primarySubjectForTutor}
          topic={null}
        />
      )}
      {ownedTopics.count > 0 && (
        <Link
          href="/my-topics"
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3.5 text-[12px] font-medium text-foreground transition-colors hover:border-accent-border/60 hover:bg-surface"
        >
          <UserCircle className="h-3.5 w-3.5" weight="duotone" />
          View your authored topics
          <ArrowRight className="h-3 w-3" weight="bold" />
        </Link>
      )}
      <RecentActivityStrip data={recentActivity} />
      <WhatsNewStrip updates={whatsNew} />
    </>
  );
}

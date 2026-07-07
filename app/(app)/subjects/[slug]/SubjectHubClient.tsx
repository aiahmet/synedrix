"use client";

import Link from "next/link";
import { Preloaded, usePreloadedQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { SubjectHeader } from "@/components/dashboard/SubjectHeader";
import { SubjectDetailStats } from "@/components/dashboard/SubjectDetailStats";
import { UpNextBanner } from "@/components/dashboard/UpNextBanner";
import { AskTutorCta } from "@/components/dashboard/AskTutorCta";
import { SubjectRoadmap } from "@/components/dashboard/SubjectRoadmap";
import { FoundationsToFix } from "@/components/dashboard/FoundationsToFix";
import { SubjectPracticeModes } from "@/components/dashboard/SubjectPracticeModes";
import { SubjectNotesPanel } from "@/components/dashboard/SubjectNotesPanel";
import { SubjectErrorLog } from "@/components/dashboard/SubjectErrorLog";
import { SubjectTestsPanel } from "@/components/dashboard/SubjectTestsPanel";
import { ConfidenceVsActual } from "@/components/dashboard/ConfidenceVsActual";
import { CockpitCard } from "@/components/dashboard/CockpitCard";
import { ArrowLeft, Books } from "@/components/landing/icons";

export function SubjectHubClient({
  preloaded,
  fallbackSlug,
}: {
  readonly preloaded: Preloaded<typeof api.subjects.getHub>;
  readonly fallbackSlug: string;
}) {
  const data = usePreloadedQuery(preloaded);
  if (!data) {
    return <SubjectNotFound slug={fallbackSlug} />;
  }

  const nextBestChapterSlug =
    data.nextBest?.chapter.slug ?? data.chapters[0]?.slug ?? "";
  const nextBestTopicSlug =
    data.nextBest?.topic.slug ?? data.chapters[0]?.topics[0]?.slug ?? "";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:gap-7">
      <SubjectHeader
        subject={data.subject}
        enrolled={data.enrolled}
        aggregate={data.aggregate}
      />
      <UpNextBanner
        nextBest={data.nextBest}
        enrolled={data.enrolled}
      />
      <SubjectDetailStats
        mastery={data.aggregate.mastery}
        topicsStudied={data.aggregate.topicsStudied}
        topicCount={data.aggregate.topicCount}
        lastStudiedAt={data.aggregate.lastStudiedAt}
      />

      {data.foundationsToFix.length > 0 && (
        <FoundationsToFix
          gaps={data.foundationsToFix}
          subjectSlug={data.subject.slug}
          subjectColor={data.subject.color}
        />
      )}

      <SubjectRoadmap
        chapters={data.chapters}
        subjectSlug={data.subject.slug}
        subjectColor={data.subject.color}
        subjectIcon={data.subject.icon}
      />

      <SubjectPracticeModes
        runs={data.practiceRuns}
        subjectSlug={data.subject.slug}
        subjectColor={data.subject.color}
        nextBestChapterSlug={nextBestChapterSlug}
        nextBestTopicSlug={nextBestTopicSlug}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-7">
        <SubjectNotesPanel
          notes={data.savedNotes}
          subjectSlug={data.subject.slug}
        />
        <SubjectErrorLog
          mistakes={data.recentMistakes}
          subjectSlug={data.subject.slug}
          subjectColor={data.subject.color}
        />
      </div>

      <SubjectTestsPanel
        runs={data.practiceRuns}
        subjectSlug={data.subject.slug}
      />

      <ConfidenceVsActual
        data={data.practiceRuns
          .filter(
            (r) =>
              r.status === "graded" &&
              r.overallScore !== null &&
              r.topicConfidence !== null
          )
          .map((r) => ({
            topicId: r.topicId,
            topicSlug: r.topicSlug,
            topicTitle: r.topicTitle,
            chapterSlug: r.chapterSlug,
            confidence: r.topicConfidence ?? 0,
            actualScore: r.overallScore ?? 0,
            lastPracticeAt: r.completedAt,
          }))}
        subjectSlug={data.subject.slug}
        subjectColor={data.subject.color}
      />

      <AskTutorCta
        subject={{
          slug: data.subject.slug,
          title: data.subject.title,
        }}
        topic={null}
      />
    </div>
  );
}

function SubjectNotFound({ slug }: { readonly slug: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <CockpitCard>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Books className="h-6 w-6" style={{ color: "var(--subject-french)" }} weight="duotone" />
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            No subject called &ldquo;{slug}&rdquo;
          </h2>
          <p className="mx-auto max-w-sm text-[12.5px] text-muted-foreground">
            The slug you followed does not match a canonical subject.
            Pick one from the catalog and the hub will load.
          </p>
          <Link
            href="/subjects"
            className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to subjects
          </Link>
        </div>
      </CockpitCard>
    </div>
  );
}

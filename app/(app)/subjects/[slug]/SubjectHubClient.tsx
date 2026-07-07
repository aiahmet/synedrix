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
      <div className="rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-[var(--shadow-soft)]">
        <div className="rounded-xl bg-background p-7 text-center sm:p-8">
          <span
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--subject-french) 12%, transparent)",
              color: "var(--subject-french)",
            }}
            aria-hidden
          >
            <Books className="h-5 w-5" weight="duotone" />
          </span>
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            No subject called &ldquo;{slug}&rdquo;
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            The slug you followed does not match a canonical subject.
            Pick one from the catalog and the hub will load.
          </p>
          <Link
            href="/subjects"
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to subjects
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Preloaded, usePreloadedQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { SubjectHeader } from "@/components/dashboard/SubjectHeader";
import { SubjectDetailStats } from "@/components/dashboard/SubjectDetailStats";
import { ChapterList } from "@/components/dashboard/ChapterList";
import { ArrowLeft, Books } from "@/components/landing/icons";

/**
 * SubjectDetailClient.
 *
 * The only client island on /subjects/[slug]. Subscribes to the
 * preloaded Convex query. The query returns `null` for unknown
 * slugs or unauthenticated requests, so the not-found state
 * is rendered here (the page server component cannot inspect
 * the resolved value of a `Preloaded` query).
 *
 * Composes the three cockpit regions: header (with CTA),
 * stats row, and chapter list. All visual regions are
 * server-renderable primitives; only the data subscription
 * crosses the client boundary.
 */
export function SubjectDetailClient({
  preloaded,
  fallbackSlug,
}: {
  readonly preloaded: Preloaded<typeof api.subjects.getBySlug>;
  readonly fallbackSlug: string;
}) {
  const data = usePreloadedQuery(preloaded);
  if (!data) {
    return <SubjectNotFound slug={fallbackSlug} />;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:gap-7">
      <SubjectHeader
        subject={data.subject}
        enrolled={data.enrolled}
        aggregate={data.aggregate}
        nextBest={data.nextBest}
      />
      <SubjectDetailStats
        mastery={data.aggregate.mastery}
        topicsStudied={data.aggregate.topicsStudied}
        topicCount={data.aggregate.topicCount}
        lastStudiedAt={data.aggregate.lastStudiedAt}
      />
      <ChapterList
        chapters={data.chapters}
        subjectSlug={data.subject.slug}
      />
    </div>
  );
}

/**
 * Honest 404 for an unknown subject slug.
 *
 * Renders inside the cockpit card language so the user has a
 * real exit (back to /subjects) instead of an empty screen.
 */
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
            Pick one from the catalog and the detail view will load.
          </p>
          <Link
            href="/subjects"
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to subjects
          </Link>
        </div>
      </div>
    </div>
  );
}

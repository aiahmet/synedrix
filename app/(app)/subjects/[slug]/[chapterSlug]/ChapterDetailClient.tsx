"use client";

import Link from "next/link";
import { Preloaded, usePreloadedQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { ChapterHeader } from "@/components/dashboard/ChapterHeader";
import { TopicList } from "@/components/dashboard/TopicList";
import { ArrowLeft, Books } from "@/components/landing/icons";

/**
 * ChapterDetailClient.
 *
 * The only client island on /subjects/[slug]/[chapterSlug].
 * Subscribes to the preloaded Convex query. The query returns
 * `null` for unknown slugs, so the not-found state is rendered
 * here (the page server component cannot inspect a `Preloaded`
 * value).
 *
 * Composes the chapter header (breadcrumb, color band,
 * metadata) and the topic list (per-topic mastery, last
 * studied, and a Start topic CTA). The header is server-
 * renderable; only the topic list is client because its CTAs
 * need useMutation + useRouter.
 */
export function ChapterDetailClient({
  preloaded,
  fallbackSubjectSlug,
  fallbackChapterSlug,
}: {
  readonly preloaded: Preloaded<typeof api.subjects.getChapterBySlug>;
  readonly fallbackSubjectSlug: string;
  readonly fallbackChapterSlug: string;
}) {
  const data = usePreloadedQuery(preloaded);
  if (!data) {
    return (
      <ChapterOrSubjectNotFound
        subjectSlug={fallbackSubjectSlug}
        chapterSlug={fallbackChapterSlug}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:gap-7">
      <ChapterHeader
        subject={data.subject}
        chapter={data.chapter}
        topicCount={data.aggregate.topicCount}
        estimatedMinutesTotal={data.aggregate.estimatedMinutesTotal}
      />
      <TopicList topics={data.topics} subject={data.subject} />
    </div>
  );
}

/**
 * Honest 404 for an unknown subject or chapter slug.
 */
function ChapterOrSubjectNotFound({
  subjectSlug,
  chapterSlug,
}: {
  readonly subjectSlug: string;
  readonly chapterSlug: string;
}) {
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
            Chapter not found
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            The path <span className="font-mono">{subjectSlug}</span> /{" "}
            <span className="font-mono">{chapterSlug}</span> does not match a
            chapter in the curriculum.
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

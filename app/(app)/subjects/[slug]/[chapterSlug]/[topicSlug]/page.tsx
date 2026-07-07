import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { Preloaded } from "convex/react";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import { TopicDetailClient } from "./TopicDetailClient";
import { ArrowLeft, Books } from "@/components/landing/icons";

/**
 * /subjects/[slug]/[chapterSlug]/[topicSlug].
 *
 * The atomic learning screen. One subject, one chapter, one topic,
 * surrounded by:
 *   - a TopicHeader with mastery pill, breadcrumb chain, and a
 *     "Start a study session on this topic" CTA that fires
 *     `api.studySessions.start({ topicId })` and routes to
 *     `/tutor?subject=...&topic=...`
 *   - the learning objectives list (with a per-objective mastery
 *     check when topic mastery >= 0.6)
 *   - a three-depth tab (simple / standard / rigorous) over the
 *     seeded LessonBlocks, one read per depth from
 *     `by_topic_depth`
 *   - a PrerequisiteStrip listing prerequisite-topic chips with
 *     their per-prereq mastery; the current topic shows a small
 *     "Locked — finish X first" hint when at least one prereq
 *     is below 50% mastery
 *   - the most recent five MistakeEntry rows for this topic
 *   - a NextBestTopicCard recommending the highest-scoring
 *     unmastered topic across the user's enrolled subjects
 *   - an AskTutorCta that routes to /tutor with a quoted block
 *     (if any text is currently selected inside the lesson panels)
 *     or an open-ended composer
 *
 * Server shell that preloads `api.subjects.getTopicDetailBySlug`
 * and delegates rendering to a small client island. Auth-gated
 * at the layout level and re-verified here. If Convex is offline,
 * we render a small honest fallback inside the cockpit card
 * language so the user always has an exit.
 */
export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ slug: string; chapterSlug: string; topicSlug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { slug, chapterSlug, topicSlug } = await params;

  let preloaded: Preloaded<typeof api.subjects.getTopicDetailBySlug> | null =
    null;
  let isConvexConfigured = true;

  try {
    preloaded = await preloadQuery(api.subjects.getTopicDetailBySlug, {
      subjectSlug: slug,
      chapterSlug,
      topicSlug,
    });
  } catch (err) {
    console.warn(
      "preloadQuery(api.subjects.getTopicDetailBySlug) failed:",
      err
    );
    isConvexConfigured = false;
  }

  if (!preloaded) {
    return (
      <OfflineFallback
        subjectSlug={slug}
        chapterSlug={chapterSlug}
        topicSlug={topicSlug}
      />
    );
  }

  return (
    <>
      <TopicDetailClient
        preloaded={preloaded}
        fallbackSubjectSlug={slug}
        fallbackChapterSlug={chapterSlug}
        fallbackTopicSlug={topicSlug}
      />
      {!isConvexConfigured && (
        <p className="mx-auto mt-2 max-w-5xl text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          Convex offline. Run{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 text-foreground">
            npx convex dev
          </code>{" "}
          to wire the topic view.
        </p>
      )}
    </>
  );
}

/**
 * Offline fallback when Convex is unreachable.
 */
function OfflineFallback({
  subjectSlug,
  chapterSlug,
  topicSlug,
}: {
  readonly subjectSlug: string;
  readonly chapterSlug: string;
  readonly topicSlug: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-[var(--shadow-soft)]">
        <div className="rounded-xl bg-background p-7 text-center sm:p-8">
          <span
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--subject-physics) 14%, transparent)",
              color: "var(--subject-physics)",
            }}
            aria-hidden
          >
            <Books className="h-5 w-5" weight="duotone" />
          </span>
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            Could not load &ldquo;{topicSlug}&rdquo;
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            The topic view needs Convex to load the lesson blocks,
            prerequisites, and your progress. Start the dev server
            and the page will appear.
          </p>
          <Link
            href={`/subjects/${subjectSlug}/${chapterSlug}`}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to chapter
          </Link>
        </div>
      </div>
    </div>
  );
}

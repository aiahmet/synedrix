import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { Preloaded } from "convex/react";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import { ChapterDetailClient } from "./ChapterDetailClient";
import { CockpitCard } from "@/components/dashboard/CockpitCard";
import { ArrowLeft, Books } from "@/components/landing/icons";

/**
 * /subjects/[slug]/[chapterSlug].
 *
 * Chapter drilldown. Shows the chapter's ordered topic list,
 * per-topic mastery, last-studied timestamp, difficulty and
 * exam-relevance signals, and a per-topic "Start topic" CTA
 * that creates a topic-scoped study session.
 *
 * Auth-gated at the layout level and re-verified here. The
 * page is a thin server shell that preloads the Convex
 * query and delegates rendering to a small client island.
 * If Convex is offline, we render a small honest fallback
 * inside the cockpit card language.
 */
export default async function ChapterDetailPage({
  params,
}: {
  params: Promise<{ slug: string; chapterSlug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { slug, chapterSlug } = await params;

  let preloaded: Preloaded<typeof api.subjects.getChapterBySlug> | null = null;
  let isConvexConfigured = true;

  try {
    preloaded = await preloadQuery(api.subjects.getChapterBySlug, {
      subjectSlug: slug,
      chapterSlug,
    });
  } catch {
    isConvexConfigured = false;
  }

  if (!preloaded) {
    return <OfflineFallback subjectSlug={slug} chapterSlug={chapterSlug} />;
  }

  return (
    <>
      <ChapterDetailClient
        preloaded={preloaded}
        fallbackSubjectSlug={slug}
        fallbackChapterSlug={chapterSlug}
      />
      {!isConvexConfigured && (
        <p className="mx-auto mt-2 max-w-5xl text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          Convex offline. Run{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 text-foreground">
            npx convex dev
          </code>{" "}
          to wire the chapter view.
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
}: {
  readonly subjectSlug: string;
  readonly chapterSlug: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <CockpitCard>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Books className="h-6 w-6" style={{ color: "var(--subject-physics)" }} weight="duotone" />
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            Could not load &ldquo;{chapterSlug}&rdquo;
          </h2>
          <p className="mx-auto max-w-sm text-[12.5px] text-muted-foreground">
            The chapter view needs Convex to load the topic list.
            Start the dev server and the topics will appear.
          </p>
          <Link
            href={`/subjects/${subjectSlug}`}
            className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to subject
          </Link>
        </div>
      </CockpitCard>
    </div>
  );
}

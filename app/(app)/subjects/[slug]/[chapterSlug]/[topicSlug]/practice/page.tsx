import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { Preloaded } from "convex/react";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import { CanonicalPracticeClient } from "./CanonicalPracticeClient";
import { ArrowLeft, Books } from "@/components/landing/icons";

export default async function CanonicalPracticePage({
  params,
}: {
  params: Promise<{ slug: string; chapterSlug: string; topicSlug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { slug, chapterSlug, topicSlug } = await params;

  let preloaded: Preloaded<typeof api.subjects.getTopicDetailBySlug> | null = null;

  try {
    preloaded = await preloadQuery(api.subjects.getTopicDetailBySlug, {
      subjectSlug: slug,
      chapterSlug,
      topicSlug,
    });
  } catch (err) {
    console.warn("preloadQuery for canonical practice failed:", err);
  }

  if (!preloaded) {
    return <OfflineFallback subjectSlug={slug} chapterSlug={chapterSlug} topicSlug={topicSlug} />;
  }

  return (
    <Suspense fallback={<PracticeFallback topicSlug={topicSlug} />}>
      <CanonicalPracticeClient
        preloaded={preloaded}
        fallbackSubjectSlug={slug}
        fallbackChapterSlug={chapterSlug}
        fallbackTopicSlug={topicSlug}
      />
    </Suspense>
  );
}

function PracticeFallback({ topicSlug }: { readonly topicSlug: string }) {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
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
            <Books className="h-5 w-5 animate-pulse" weight="duotone" />
          </span>
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            Preparing practice for {topicSlug}
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            Loading questions…
          </p>
        </div>
      </div>
    </div>
  );
}

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
            Could not load practice
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            The practice runner needs Convex to load the items. Start the
            dev server and the items will appear.
          </p>
          <Link
            href={`/subjects/${subjectSlug}/${chapterSlug}/${topicSlug}`}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-all hover:bg-foreground/90"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to topic
          </Link>
        </div>
      </div>
    </div>
  );
}

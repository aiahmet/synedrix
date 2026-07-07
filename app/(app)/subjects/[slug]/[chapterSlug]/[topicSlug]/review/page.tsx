import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";
import { ArrowLeft, ClockCounterClockwise, ArrowUpRight } from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";

export default async function TopicReviewPage({
  params,
}: {
  params: Promise<{ slug: string; chapterSlug: string; topicSlug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { slug, chapterSlug, topicSlug } = await params;

  let data: Awaited<ReturnType<typeof fetchQuery<typeof api.subjects.getTopicDetailBySlug>>> = null;

  try {
    data = await fetchQuery(api.subjects.getTopicDetailBySlug, {
      subjectSlug: slug,
      chapterSlug,
      topicSlug,
    });
  } catch {
    return <OfflineFallback slug={slug} chapterSlug={chapterSlug} topicSlug={topicSlug} />;
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl">
        <CockpitCard>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <ClockCounterClockwise className="h-5 w-5 text-muted-foreground" weight="duotone" />
            <p className="text-[13px] text-muted-foreground">Topic not found.</p>
            <Link href={`/subjects/${slug}`} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-[12.5px] font-medium text-background">
              <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
              Back to subject
            </Link>
          </div>
        </CockpitCard>
      </div>
    );
  }

  const subjectColor = data.subject.color
    ? resolveColorVar(data.subject.color)
    : "var(--accent)";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1.5 pt-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/subjects/${slug}/${chapterSlug}/${topicSlug}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
          </Link>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em]" style={{ color: subjectColor }}>
            / subjects / {slug} / {chapterSlug} / {topicSlug} / review
          </span>
        </div>
        <h1 className="text-balance text-[clamp(1.6rem,2.2vw+0.5rem,2rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          Review: {data.topic.title}
        </h1>
        <p className="max-w-xl text-pretty text-[13px] text-muted-foreground">
          Mistakes, prerequisites, and resources to reinforce this topic.
        </p>
      </header>

      <CockpitCard>
        <CockpitCardHeader label="Mastery" />
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[24px] font-semibold tabular-nums text-foreground">
              {Math.round(data.topic.mastery * 100)}%
            </span>
            <span className="text-[11px] text-muted-foreground">mastery</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[24px] font-semibold tabular-nums text-foreground">
              {Math.round(data.topic.confidence * 100)}%
            </span>
            <span className="text-[11px] text-muted-foreground">confidence</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[24px] font-semibold tabular-nums text-foreground">
              {Math.round(data.topic.timeSpentSec / 60)}m
            </span>
            <span className="text-[11px] text-muted-foreground">time spent</span>
          </div>
        </div>
      </CockpitCard>

      {data.commonMistakes.length > 0 && (
        <CockpitCard>
          <CockpitCardHeader label={`Mistakes (${data.commonMistakes.length})`} />
          <div className="flex flex-col gap-2.5">
            {data.commonMistakes.map((m) => (
              <div key={m.id} className="rounded-lg border border-border/60 bg-surface-elevated/40 p-3.5">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    {m.mistakeType}
                  </span>
                  <p className="text-[12.5px] font-medium text-foreground">{m.question}</p>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <span className="text-[11.5px]">
                      <span className="text-danger/80">Your answer: </span>
                      <span className="text-muted-foreground">{m.userAnswer}</span>
                    </span>
                    <span className="text-[11.5px]">
                      <span className="text-accent/80">Correct: </span>
                      <span className="text-muted-foreground">{m.correctAnswer}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CockpitCard>
      )}

      {data.prerequisites.length > 0 && (
        <CockpitCard>
          <CockpitCardHeader label={`Prerequisites (${data.prerequisites.length})`} />
          <div className="flex flex-col gap-2">
            {data.prerequisites.map((p) => (
              <Link
                key={p.id}
                href={`/subjects/${p.subjectSlug}/${p.chapterSlug}/${p.slug}`}
                className="group flex items-center justify-between rounded-md px-3 py-2.5 transition-colors hover:bg-surface-elevated"
              >
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-[13px] font-medium text-foreground">{p.title}</span>
                  <span className="text-[11px] text-muted-foreground">{p.subjectSlug}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`font-mono text-[11px] tabular-nums ${p.unlocked ? "text-muted-foreground" : "text-red-600 dark:text-red-400"}`}>
                    {Math.round(p.mastery * 100)}%
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" weight="bold" />
                </div>
              </Link>
            ))}
          </div>
        </CockpitCard>
      )}

      {data.formulaSheet && (
        <CockpitCard>
          <CockpitCardHeader label="Formulas" />
          <div className="flex flex-col gap-2.5">
            {data.formulaSheet.contents.map((f, idx) => (
              <div key={idx} className="rounded-lg border border-border/60 bg-surface-elevated/40 p-3.5">
                <span className="text-[13px] font-medium text-foreground">{f.name}</span>
                <p className="mt-1 font-mono text-[12.5px] text-muted-foreground">{f.expression}</p>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{f.when}</span>
              </div>
            ))}
          </div>
        </CockpitCard>
      )}

      {data.vocabularyDeck && data.vocabularyDeck.contents.length > 0 && (
        <CockpitCard>
          <CockpitCardHeader label={`Vocabulary (${data.vocabularyDeck.contents.length} terms)`} />
          <div className="flex flex-col gap-2">
            {data.vocabularyDeck.contents.map((v, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-md px-3 py-2 border border-border/60 bg-surface-elevated/40">
                <span className="text-[13px] font-medium text-foreground">{v.term}</span>
                <span className="text-[12px] text-muted-foreground">{v.definition}</span>
              </div>
            ))}
          </div>
        </CockpitCard>
      )}

      <Link
        href={`/subjects/${slug}/${chapterSlug}/${topicSlug}`}
        className="inline-flex h-9 w-fit items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
        Back to topic
      </Link>
    </div>
  );
}

function OfflineFallback({
  slug,
  chapterSlug,
  topicSlug,
}: {
  readonly slug: string;
  readonly chapterSlug: string;
  readonly topicSlug: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-surface-elevated p-1.5">
        <div className="rounded-xl bg-background p-7 text-center sm:p-8">
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            Could not load review for &ldquo;{topicSlug}&rdquo;
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            Start the Convex dev server to review this topic.
          </p>
          <Link
            href={`/subjects/${slug}/${chapterSlug}/${topicSlug}`}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to topic
          </Link>
        </div>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";
import { ArrowLeft, Target, ArrowUpRight } from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";

export default async function SubjectPracticePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { slug } = await params;

  let subject: Awaited<ReturnType<typeof fetchQuery<typeof api.subjects.getHub>>> = null;

  try {
    subject = await fetchQuery(api.subjects.getHub, { slug });
  } catch {
    return <OfflineFallback slug={slug} />;
  }

  if (!subject) {
    return (
      <div className="mx-auto max-w-3xl">
        <CockpitCard>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Target className="h-5 w-5 text-muted-foreground" weight="duotone" />
            <p className="text-[13px] text-muted-foreground">Subject not found.</p>
            <Link href="/subjects" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-[12.5px] font-medium text-background">
              <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
              Back to subjects
            </Link>
          </div>
        </CockpitCard>
      </div>
    );
  }

  const subjectColor = subject.subject.color
    ? resolveColorVar(subject.subject.color)
    : "var(--accent)";

  const practiceTopics = subject.chapters.flatMap((ch) =>
    ch.topics.map((t) => ({ ...t, chapterSlug: ch.slug, chapterTitle: ch.title }))
  );

  const studiedTopics = practiceTopics.filter((t) => t.isStudied);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1.5 pt-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/subjects/${slug}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
          </Link>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em]" style={{ color: subjectColor }}>
            / subjects / {slug} / practice
          </span>
        </div>
        <h1 className="text-balance text-[clamp(1.6rem,2.2vw+0.5rem,2rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          {subject.subject.title} practice
        </h1>
        <p className="max-w-xl text-pretty text-[13px] text-muted-foreground">
          Jump into a practice session for any topic in this subject. Topics you&apos;ve studied are pinned to the top.
        </p>
      </header>

      {studiedTopics.length > 0 && (
        <CockpitCard>
          <CockpitCardHeader label="Continue practicing" />
          <div className="flex flex-col gap-1.5">
            {studiedTopics.slice(0, 6).map((t) => (
              <Link
                key={t.id}
                href={`/subjects/${slug}/${t.chapterSlug}/${t.slug}`}
                className="group flex items-center justify-between rounded-md px-3 py-2.5 transition-colors hover:bg-surface-elevated"
              >
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-[13px] font-medium text-foreground">{t.title}</span>
                  <span className="text-[11px] text-muted-foreground">{t.chapterTitle}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                    {Math.round(t.mastery * 100)}%
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" weight="bold" />
                </div>
              </Link>
            ))}
          </div>
        </CockpitCard>
      )}

      <CockpitCard>
        <CockpitCardHeader label="All topics" />
        <div className="flex flex-col gap-1.5">
          {practiceTopics.map((t) => (
            <Link
              key={t.id}
              href={
                t.isStudied
                  ? `/subjects/${slug}/${t.chapterSlug}/${t.slug}`
                  : `/subjects/${slug}/${t.chapterSlug}/${t.slug}`
              }
              className="group flex items-center justify-between rounded-md px-3 py-2.5 transition-colors hover:bg-surface-elevated"
            >
              <div className="flex flex-col min-w-0">
                <span className="truncate text-[13px] font-medium text-foreground">{t.title}</span>
                <span className="text-[11px] text-muted-foreground">{t.chapterTitle}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {t.isStudied ? (
                  <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                    {Math.round(t.mastery * 100)}%
                  </span>
                ) : (
                  <span className="text-[10.5px] text-muted-foreground">Not started</span>
                )}
                <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" weight="bold" />
              </div>
            </Link>
          ))}
        </div>
      </CockpitCard>

      <Link href="/practice" className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-accent-border/40 bg-accent-subtle/20 px-3.5 text-[12px] font-medium text-accent transition-colors hover:border-accent-border/60 hover:bg-accent-subtle/30">
        <Target className="h-3.5 w-3.5" weight="duotone" />
        Practice arena
        <ArrowUpRight className="h-3 w-3" weight="bold" />
      </Link>
    </div>
  );
}

function OfflineFallback({ slug }: { readonly slug: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <CockpitCard>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            Could not load practice for &ldquo;{slug}&rdquo;
          </h2>
          <p className="mx-auto max-w-sm text-[12.5px] text-muted-foreground">
            Start the Convex dev server to view practice options.
          </p>
          <Link href={`/subjects/${slug}`} className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-[12.5px] font-medium text-background">
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to subject
          </Link>
        </div>
      </CockpitCard>
    </div>
  );
}

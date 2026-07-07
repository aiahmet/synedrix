import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";
import { ArrowLeft, ClipboardText, ArrowUpRight } from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";

export default async function SubjectTestsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { slug } = await params;

  let data: Awaited<ReturnType<typeof fetchQuery<typeof api.subjects.getHub>>> = null;

  try {
    data = await fetchQuery(api.subjects.getHub, { slug });
  } catch {
    return <OfflineFallback slug={slug} />;
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl">
        <CockpitCard>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <ClipboardText className="h-5 w-5 text-muted-foreground" weight="duotone" />
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

  const subjectColor = data.subject.color
    ? resolveColorVar(data.subject.color)
    : "var(--accent)";

  const gradedRuns = data.practiceRuns.filter((r) => r.status === "graded");
  const inProgressRuns = data.practiceRuns.filter((r) => r.status === "in_progress");

  const avgScore =
    gradedRuns.length > 0
      ? Math.round(
          (gradedRuns.reduce((s, r) => s + (r.overallScore ?? 0), 0) /
            gradedRuns.length) *
            100
        )
      : null;

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
            / subjects / {slug} / tests
          </span>
        </div>
        <h1 className="text-balance text-[clamp(1.6rem,2.2vw+0.5rem,2rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          {data.subject.title} tests
        </h1>
      </header>

      {data.practiceRuns.length === 0 ? (
        <CockpitCard>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <ClipboardText className="h-5 w-5 text-muted-foreground" weight="duotone" />
            <p className="text-[12.5px] text-muted-foreground">
              No practice runs yet for this subject. Start practicing to see your test history here.
            </p>
          </div>
        </CockpitCard>
      ) : (
        <>
          <CockpitCard>
            <CockpitCardHeader label="Summary" />
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[24px] font-semibold tabular-nums text-foreground">
                  {gradedRuns.length}
                </span>
                <span className="text-[11px] text-muted-foreground">graded runs</span>
              </div>
              {avgScore !== null && (
                <div className="flex flex-col">
                  <span className="text-[24px] font-semibold tabular-nums text-foreground">
                    {avgScore}%
                  </span>
                  <span className="text-[11px] text-muted-foreground">avg. score</span>
                </div>
              )}
              {inProgressRuns.length > 0 && (
                <div className="flex flex-col">
                  <span className="text-[24px] font-semibold tabular-nums text-accent">
                    {inProgressRuns.length}
                  </span>
                  <span className="text-[11px] text-muted-foreground">in progress</span>
                </div>
              )}
            </div>
          </CockpitCard>

          {gradedRuns.length > 0 && (
            <CockpitCard>
              <CockpitCardHeader label="Graded runs" />
              <div className="flex flex-col gap-2">
                {gradedRuns.map((run) => (
                  <Link
                    key={run.id}
                    href={`/subjects/${slug}/${run.chapterSlug}/${run.topicSlug}`}
                    className="group flex items-center justify-between rounded-md px-3 py-2.5 transition-colors hover:bg-surface-elevated"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {run.topicTitle}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {run.grade && `Grade ${run.grade} · `}
                        {run.itemCount} items
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {run.overallScore !== null && (
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {Math.round(run.overallScore * 100)}%
                        </span>
                      )}
                      <ArrowUpRight
                        className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        weight="bold"
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </CockpitCard>
          )}

          {inProgressRuns.length > 0 && (
            <CockpitCard>
              <CockpitCardHeader label="In progress" />
              <div className="flex flex-col gap-2">
                {inProgressRuns.map((run) => (
                  <Link
                    key={run.id}
                    href={`/subjects/${slug}/${run.chapterSlug}/${run.topicSlug}`}
                    className="group flex items-center justify-between rounded-md px-3 py-2.5 transition-colors hover:bg-surface-elevated"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {run.topicTitle}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {run.answeredCount} / {run.itemCount} answered
                      </span>
                    </div>
                    <ArrowUpRight
                      className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      weight="bold"
                    />
                  </Link>
                ))}
              </div>
            </CockpitCard>
          )}
        </>
      )}

      <Link
        href={`/subjects/${slug}`}
        className="inline-flex h-9 w-fit items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
        Back to subject
      </Link>
    </div>
  );
}

function OfflineFallback({ slug }: { readonly slug: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-surface-elevated p-1.5">
        <div className="rounded-xl bg-background p-7 text-center sm:p-8">
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            Could not load tests for &ldquo;{slug}&rdquo;
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            Start the Convex dev server to view your test history.
          </p>
          <Link href={`/subjects/${slug}`} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background">
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to subject
          </Link>
        </div>
      </div>
    </div>
  );
}

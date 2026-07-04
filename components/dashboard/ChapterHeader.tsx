import Link from "next/link";
import { ArrowLeft, Books, Stack, Timer } from "@/components/landing/icons";

/**
 * ChapterHeader.
 *
 * The top band of the /subjects/[slug]/[chapterSlug] page.
 * Carries the breadcrumb chain (all subjects / subject /
 * chapter), the chapter's color-coded identity, the chapter's
 * description, and a small metadata row (topic count + total
 * estimated minutes).
 *
 * Pure server-renderable. The primary "Start a study session"
 * CTA lives in the per-topic rows in the list below so the
 * user can scope a session to a specific topic.
 */
export function ChapterHeader({
  subject,
  chapter,
  topicCount,
  estimatedMinutesTotal,
}: {
  readonly subject: {
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
  };
  readonly chapter: {
    readonly slug: string;
    readonly title: string;
    readonly description: string | null;
    readonly order: number;
  };
  readonly topicCount: number;
  readonly estimatedMinutesTotal: number;
}) {
  const fillVar = resolveColorVar(subject.color);

  return (
    <header className="flex flex-col gap-5">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5"
      >
        <Link
          href="/subjects"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated/60 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm transition-colors hover:border-accent-border/60 hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" weight="bold" />
          All subjects
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <Link
          href={`/subjects/${subject.slug}`}
          className="rounded-full px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          {subject.title}
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="rounded-full bg-accent-subtle/40 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
          {chapter.title}
        </span>
      </nav>

      <div className="flex items-start gap-4">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border"
          style={{
            backgroundColor: `color-mix(in srgb, ${fillVar} 14%, transparent)`,
            borderColor: `color-mix(in srgb, ${fillVar} 30%, transparent)`,
          }}
          aria-hidden
        >
          <Books
            className="h-6 w-6"
            weight="duotone"
            style={{ color: fillVar }}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-border bg-surface-elevated px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              Chapter {String(chapter.order).padStart(2, "0")}
            </span>
            <h1 className="text-balance text-[clamp(1.6rem,2.2vw+0.5rem,2rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
              {chapter.title}
            </h1>
          </div>
          {chapter.description && (
            <p className="mt-2 max-w-2xl text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
              {chapter.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Stack className="h-3.5 w-3.5" weight="duotone" />
              {topicCount} {topicCount === 1 ? "topic" : "topics"}
            </span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="inline-flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" weight="duotone" />
              ~{estimatedMinutesTotal} min total
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * Resolve a subject color slug to a concrete CSS variable.
 * Falls back to the global accent so the bar is always visible.
 */
function resolveColorVar(slug: string | undefined): string {
  if (!slug) return "var(--accent)";
  const normalized = slug.startsWith("subject-") ? slug : `subject-${slug}`;
  return `var(--${normalized})`;
}

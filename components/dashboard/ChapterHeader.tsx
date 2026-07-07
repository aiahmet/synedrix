import Link from "next/link";
import { ArrowLeft, Stack, SubjectGlyph, Timer } from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";

/**
 * ChapterHeader.
 *
 * The top band of the /subjects/[slug]/[chapterSlug] page.
 * Carries the breadcrumb chain (all subjects / subject /
 * chapter), the chapter's color-coded identity, the chapter's
 * description, and a small metadata row (topic count + total
 * estimated minutes).
 *
 * Per `docs/SYNEDRIX-FRONTEND-STYLE.md`:
 *
 *   - **No icon container.** The chapter's subject glyph
 *     renders at native size in the per-subject hue via the
 *     shared `SubjectGlyph` component (§8).
 *
 *   - **No pill chips.** The "Chapter N" label is plain
 *     uppercase muted text (§1).
 *
 *   - **No bouncy CTAs.** The breadcrumb is a quiet
 *     `transition-colors` link.
 *
 * Pure server-renderable.
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
    readonly icon?: string;
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
          className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" weight="bold" />
          All subjects
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <Link
          href={`/subjects/${subject.slug}`}
          className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          {subject.title}
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-foreground">
          {chapter.title}
        </span>
      </nav>

      <div className="flex items-start gap-4">
        {/* Subject glyph at native size, per-subject hue, no
            container. The chapter is rendered without a
            glyph of its own — the subject is the identity. */}
        <SubjectGlyph
          icon={subject.icon}
          className="mt-0.5 h-7 w-7 shrink-0"
          fillVar={fillVar}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
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

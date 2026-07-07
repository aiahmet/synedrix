import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";
import { ArrowLeft, Notebook, PushPinSimple } from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";

export default async function SubjectNotesPage({
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
            <Notebook className="h-5 w-5 text-muted-foreground" weight="duotone" />
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

  const pinnedNotes = data.savedNotes.filter((n) => n.pinned);
  const unpinnedNotes = data.savedNotes.filter((n) => !n.pinned);

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
            / subjects / {slug} / notes
          </span>
        </div>
        <h1 className="text-balance text-[clamp(1.6rem,2.2vw+0.5rem,2rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          {data.subject.title} notes
        </h1>
      </header>

      {pinnedNotes.length > 0 && (
        <CockpitCard>
          <CockpitCardHeader label={`Pinned (${pinnedNotes.length})`} />
          <div className="flex flex-col gap-3">
            {pinnedNotes.map((note) => (
              <NoteRow key={note.id} note={note} subjectSlug={slug} />
            ))}
          </div>
        </CockpitCard>
      )}

      <CockpitCard>
        <CockpitCardHeader
          label={unpinnedNotes.length > 0 ? `All notes (${data.savedNotes.length})` : "Notes"}
        />
        {data.savedNotes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Notebook className="h-5 w-5 text-muted-foreground" weight="duotone" />
            <p className="text-[12.5px] text-muted-foreground">
              No notes yet for this subject. Save notes from topic pages to see them here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {unpinnedNotes.map((note) => (
              <NoteRow key={note.id} note={note} subjectSlug={slug} />
            ))}
          </div>
        )}
      </CockpitCard>

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

function NoteRow({
  note,
  subjectSlug,
}: {
  readonly note: {
    readonly id: string;
    readonly title: string;
    readonly content: string;
    readonly pinned?: boolean;
    readonly topicSlug: string | null;
    readonly topicTitle: string | null;
    readonly chapterSlug: string | null;
  };
  readonly subjectSlug: string;
}) {
  const topicHref =
    note.topicSlug && note.chapterSlug
      ? `/subjects/${subjectSlug}/${note.chapterSlug}/${note.topicSlug}`
      : null;

  return (
    <div className="rounded-lg border border-border/60 bg-surface-elevated/40 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[13px] font-medium text-foreground">{note.title}</h3>
            {note.pinned && (
              <PushPinSimple className="h-3 w-3 shrink-0 text-accent" weight="fill" />
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
            {note.content.slice(0, 200)}
            {note.content.length > 200 ? "..." : ""}
          </p>
          {note.topicTitle && (
            <span className="mt-1.5 inline-flex text-[10.5px] text-muted-foreground">
              {note.topicTitle}
            </span>
          )}
        </div>
        {topicHref && (
          <Link
            href={topicHref}
            className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2.5 text-[10.5px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            View topic
          </Link>
        )}
      </div>
    </div>
  );
}

function OfflineFallback({ slug }: { readonly slug: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-surface-elevated p-1.5">
        <div className="rounded-xl bg-background p-7 text-center sm:p-8">
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            Could not load notes for &ldquo;{slug}&rdquo;
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            Start the Convex dev server to view your notes.
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

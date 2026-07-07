import Link from "next/link";

import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import {
  Notepad,
  PencilLine,
  ArrowRight,
} from "@/components/landing/icons";

export interface SubjectNote {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly pinned?: boolean;
  readonly topicId: string | null;
  readonly topicSlug: string | null;
  readonly topicTitle: string | null;
  readonly chapterSlug: string | null;
}

export function SubjectNotesPanel({
  notes,
  subjectSlug,
}: {
  readonly notes: readonly SubjectNote[];
  readonly subjectSlug: string;
}) {
  if (notes.length === 0) {
    return (
      <CockpitCard>
        <CockpitCardHeader label="Your notes" />
        <div className="flex items-start gap-3">
          <Notepad
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
            weight="duotone"
          />
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            No notes saved for this subject yet. Notes appear here when you
            save them from a topic page.
          </p>
        </div>
      </CockpitCard>
    );
  }

  const pinnedNotes = notes.filter((n) => n.pinned);
  const unpinnedNotes = notes.filter((n) => !n.pinned);

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Your notes"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {notes.length} saved
          </span>
        }
      />

      <div className="flex flex-col gap-2.5">
        {pinnedNotes.map((note) => (
          <NoteRow key={note.id} note={note} subjectSlug={subjectSlug} pinned />
        ))}
        {unpinnedNotes.slice(0, 10).map((note) => (
          <NoteRow key={note.id} note={note} subjectSlug={subjectSlug} />
        ))}
      </div>

      {notes.length > 10 + pinnedNotes.length && (
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          +{notes.length - 10 - pinnedNotes.length} more notes
        </p>
      )}
    </CockpitCard>
  );
}

function NoteRow({
  note,
  subjectSlug,
  pinned = false,
}: {
  readonly note: SubjectNote;
  readonly subjectSlug: string;
  readonly pinned?: boolean;
}) {
  const href =
    note.topicSlug && note.chapterSlug
      ? `/subjects/${subjectSlug}/${note.chapterSlug}/${note.topicSlug}`
      : `/subjects/${subjectSlug}`;
  const preview =
    note.content.length > 120
      ? `${note.content.slice(0, 120)}…`
      : note.content;

  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-md px-2.5 py-2 transition-colors hover:bg-surface"
    >
      {pinned ? (
        <PencilLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" weight="fill" />
      ) : (
        <Notepad className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" weight="duotone" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="line-clamp-1 text-[12.5px] font-medium text-foreground">
            {note.title}
          </p>
          {note.topicTitle && (
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {note.topicTitle}
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[11.5px] leading-relaxed text-muted-foreground">
          {preview}
        </p>
      </div>
      <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" weight="bold" />
    </Link>
  );
}

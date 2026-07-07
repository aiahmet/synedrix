"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";
import {
  Notepad,
  Plus,
  PushPin,
  PushPinSlash,
  Trash,
  PencilLine,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";

export function TopicNotesPanel({
  topicId,
  lessonContent,
}: {
  readonly topicId: Id<"topics">;
  readonly lessonContent: string;
}) {
  const notes = useQuery(api.notes.listByTopic, { topicId });
  const createNote = useMutation(api.notes.create);
  const togglePin = useMutation(api.notes.togglePin);
  const removeNote = useMutation(api.notes.remove);

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const onSave = useCallback(async () => {
    const t = title.trim();
    const c = content.trim();
    if (t.length === 0) return;
    setSaving(true);
    try {
      await createNote({
        topicId,
        title: t,
        content: c,
        pinned: false,
      });
      setTitle("");
      setContent("");
      setComposing(false);
    } catch {
      // Silently handle
    } finally {
      setSaving(false);
    }
  }, [createNote, topicId, title, content]);

  const onSaveSelection = useCallback(() => {
    if (typeof window === "undefined") return;
    const sel = window.getSelection()?.toString().trim() ?? "";
    if (sel.length === 0) return;
    setComposing(true);
    setTitle(sel.slice(0, 80));
    setContent(sel);
    requestAnimationFrame(() => {
      titleRef.current?.focus();
    });
  }, []);

  const onAiSummarize = useCallback(async () => {
    setSummarizing(true);
    setComposing(true);
    setTitle("");
    setContent("");
    try {
      const res = await fetch("/api/topics/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: lessonContent }),
      });
      if (res.ok) {
        const data = (await res.json()) as { summary: string };
        setTitle("AI Topic Summary");
        setContent(data.summary);
      } else {
        setTitle("AI Topic Summary");
        setContent(lessonContent.slice(0, 3000));
      }
    } catch {
      setTitle("AI Topic Summary");
      setContent(lessonContent.slice(0, 3000));
    } finally {
      setSummarizing(false);
      requestAnimationFrame(() => {
        titleRef.current?.focus();
      });
    }
  }, [lessonContent]);

  const rows = notes ?? [];
  const pinned = rows.filter((n) => n.pinned ?? false);
  const unpinned = rows.filter((n) => !(n.pinned ?? false));

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Your notes"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {rows.length} saved
          </span>
        }
      />

      {!composing && (
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => {
              setComposing(true);
              requestAnimationFrame(() => titleRef.current?.focus());
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 text-[11.5px] font-medium text-foreground transition-colors hover:bg-surface"
          >
            <Plus className="h-3.5 w-3.5" weight="bold" />
            New note
          </button>
          <button
            type="button"
            onClick={onSaveSelection}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <PencilLine className="h-3.5 w-3.5" weight="duotone" />
            Save selection
          </button>
          <button
            type="button"
            onClick={onAiSummarize}
            disabled={summarizing}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 text-[11.5px] font-medium text-muted-foreground transition-colors hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkle className={summarizing ? "h-3.5 w-3.5 animate-pulse" : "h-3.5 w-3.5"} weight="duotone" />
            {summarizing ? "Summarizing..." : "AI summarize"}
          </button>
        </div>
      )}

      {composing && (
        <div className="mb-3 flex flex-col gap-2 rounded-lg border border-accent-border/40 bg-accent-subtle/20 p-3">
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
            className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="Write or paste your note here..."
            className="resize-y rounded-md border border-border bg-background px-3 py-2 text-[12.5px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setComposing(false);
                setTitle("");
                setContent("");
              }}
              disabled={saving}
              className="inline-flex h-8 items-center rounded-md px-2.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || title.trim().length === 0}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[11.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" weight="bold" />
              {saving ? "Saving..." : "Save note"}
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 && !composing && (
        <div className="flex items-start gap-3">
          <Notepad className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" weight="duotone" />
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            No notes yet. Select any text in the lesson and click &ldquo;Save
            selection&rdquo; to capture it, or write a note from scratch.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5 mt-2">
        {pinned.map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            pinned
            onTogglePin={() => togglePin({ noteId: note.id })}
            onDelete={() => removeNote({ noteId: note.id })}
          />
        ))}
        {unpinned.slice(0, 8).map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            onTogglePin={() => togglePin({ noteId: note.id })}
            onDelete={() => removeNote({ noteId: note.id })}
          />
        ))}
      </div>
    </CockpitCard>
  );
}

function NoteRow({
  note,
  pinned = false,
  onTogglePin,
  onDelete,
}: {
  readonly note: {
    readonly id: Id<"notes">;
    readonly title: string;
    readonly content: string;
  };
  readonly pinned?: boolean;
  readonly onTogglePin: () => void;
  readonly onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const preview =
    note.content.length > 100 && !expanded
      ? `${note.content.slice(0, 100)}…`
      : note.content;

  return (
    <div
      className={cn(
        "group flex flex-col rounded-md px-2.5 py-2 transition-colors hover:bg-surface",
        pinned && "border-l-2 border-accent"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-left"
          >
            <p className="text-[12.5px] font-medium leading-snug text-foreground">
              {note.title}
            </p>
          </button>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
            {preview}
          </p>
          {note.content.length > 100 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-0.5 text-[10.5px] font-medium text-accent transition-colors hover:text-accent/80"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onTogglePin}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-accent"
          aria-label={pinned ? "Unpin note" : "Pin note"}
        >
          {pinned ? (
            <PushPinSlash className="h-3 w-3" weight="bold" />
          ) : (
            <PushPin className="h-3 w-3" weight="duotone" />
          )}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-subject-french"
          aria-label="Delete note"
        >
          <Trash className="h-3 w-3" weight="duotone" />
        </button>
      </div>
    </div>
  );
}

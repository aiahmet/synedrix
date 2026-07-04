"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { Id } from "@/convex/_generated/dataModel";

import { api } from "@/convex/_generated/api";
import {
  ChatCircle,
  ChatCircleText,
  Check,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { formatRelativeDate } from "@/lib/format/relativeDate";
import { resolveColorVar } from "@/lib/utils/subjectColor";

/**
 * TutorHistorySidebar.
 *
 * The /tutor sidebar that lists the user's recent threads
 * grouped by subject. Each row carries:
 *  - The thread title (topic or subject name)
 *  - A one-line last-message preview (denormalized onto the
 *    thread row by `tutor.listThreadsForSidebar`)
 *  - An unread badge from the denormalized `unreadCount`
 *  - A "last activity" relative timestamp
 *
 * The active thread is highlighted by matching the current
 * subject+topic against each thread's subject+topic.
 * Convex guarantees one thread per (userId, subjectId,
 * topicId) tuple via `ensureThread`, so a match is unique.
 *
 * Convex reactivity means a new message in any thread bumps
 * the row to the top of its group and increments the unread
 * count; visiting a thread calls markThreadRead which drops
 * the count back to zero.
 */
export function TutorHistorySidebar({
  currentSubjectId,
  currentTopicId,
}: {
  readonly currentSubjectId: Id<"subjects">;
  readonly currentTopicId: Id<"topics"> | null;
}) {
  const groups = useQuery(api.tutor.listThreadsForSidebar);

  return (
    <aside
      aria-label="Tutor thread history"
      className="flex h-full min-h-0 flex-col gap-2 rounded-2xl border border-border bg-surface-elevated/40 p-3 shadow-[var(--shadow-soft)]"
    >
      <header className="flex items-center justify-between px-1.5">
        <h2 className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          Threads
        </h2>
        {groups && groups.length > 0 && (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground/70">
            {groups.reduce((acc, g) => acc + g.threads.length, 0)}
          </span>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        {groups === undefined ? (
          <SidebarLoading />
        ) : groups.length === 0 ? (
          <SidebarEmpty />
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <SubjectGroup
                key={group.subject.id}
                group={group}
                currentSubjectId={currentSubjectId}
                currentTopicId={currentTopicId}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function SubjectGroup({
  group,
  currentSubjectId,
  currentTopicId,
}: {
  readonly group: {
    subject: {
      id: Id<"subjects">;
      title: string;
      slug: string;
      color: string | null;
    };
    threads: Array<{
      id: Id<"tutorThreads">;
      title: string | null;
      subjectId: Id<"subjects"> | null;
      topicId: Id<"topics"> | null;
      lastReadAt: number | null;
      createdAt: number;
      lastMessageAt: number | null;
      lastMessagePreview: string | null;
      unreadCount: number;
    }>;
  };
  readonly currentSubjectId: Id<"subjects">;
  readonly currentTopicId: Id<"topics"> | null;
}) {
  const fillVar = resolveColorVar(group.subject.color);

  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 px-1.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: fillVar }}
          aria-hidden
        />
        <h3 className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          {group.subject.title}
        </h3>
      </div>
      <ol className="flex flex-col gap-0.5">
        {group.threads.map((thread) => (
          <ThreadRow
            key={thread.id}
            thread={thread}
            isCurrent={
              thread.subjectId === currentSubjectId &&
              (thread.topicId ?? null) === (currentTopicId ?? null)
            }
          />
        ))}
      </ol>
    </section>
  );
}

function ThreadRow({
  thread,
  isCurrent,
}: {
  readonly thread: {
    id: Id<"tutorThreads">;
    title: string | null;
    subjectId: Id<"subjects"> | null;
    topicId: Id<"topics"> | null;
    lastReadAt: number | null;
    createdAt: number;
    lastMessageAt: number | null;
    lastMessagePreview: string | null;
    unreadCount: number;
  };
  readonly isCurrent: boolean;
}) {
  const href = thread.topicId
    ? `/tutor?subject=${thread.subjectId}&topic=${thread.topicId}`
    : `/tutor?subject=${thread.subjectId}`;

  return (
    <li>
      <Link
        href={href}
        aria-current={isCurrent ? "page" : undefined}
        className={cn(
          "group flex flex-col gap-1 rounded-lg border border-transparent px-2.5 py-2 transition-colors",
          isCurrent
            ? "border-accent-border/50 bg-accent-subtle/40"
            : "hover:border-border hover:bg-surface-elevated"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <ChatCircle
              className="h-3 w-3 shrink-0 text-muted-foreground"
              weight="duotone"
              aria-hidden
            />
            <span className="truncate text-[12.5px] font-medium text-foreground">
              {thread.title ?? "Thread"}
            </span>
          </span>
          {thread.lastMessageAt ? (
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
              {formatRelativeDate(thread.lastMessageAt)}
            </span>
          ) : null}
        </div>
        <div className="flex items-end justify-between gap-2">
          <p className="line-clamp-1 text-[11.5px] leading-relaxed text-muted-foreground">
            {thread.lastMessagePreview
              ? truncate(thread.lastMessagePreview, 80)
              : "No messages yet."}
          </p>
          {thread.unreadCount > 0 ? (
            <UnreadBadge count={thread.unreadCount} />
          ) : thread.lastReadAt ? (
            <Check
              className="h-3 w-3 shrink-0 text-muted-foreground/50"
              weight="bold"
              aria-label="No unread messages"
            />
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function UnreadBadge({ count }: { readonly count: number }) {
  const display = count > 9 ? "9+" : String(count);
  return (
    <span
      aria-label={`${count} unread message${count === 1 ? "" : "s"}`}
      className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 font-mono text-[9.5px] font-semibold text-accent-foreground"
    >
      {display}
    </span>
  );
}

function SidebarLoading() {
  return (
    <div className="flex flex-col gap-2 px-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5 py-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted/30" />
          <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/20" />
        </div>
      ))}
    </div>
  );
}

function SidebarEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
      <ChatCircleText
        className="h-7 w-7 text-muted-foreground"
        weight="duotone"
      />
      <p className="text-[12.5px] font-medium text-foreground">No threads yet</p>
      <p className="max-w-[14rem] text-[11.5px] text-muted-foreground">
        Open a subject to start a conversation. Your threads
        will land here.
      </p>
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

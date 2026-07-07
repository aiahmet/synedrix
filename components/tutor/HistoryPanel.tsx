"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { MagnifyingGlass, ChatCircleText, CaretLeft, CaretRight, Check, Sparkle } from "@phosphor-icons/react/dist/ssr";
import type { Id } from "@/convex/_generated/dataModel";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils/cn";
import { formatRelativeDate } from "@/lib/format/relativeDate";

/**
 * HistoryPanel.
 *
 * The collapsible thread history sidebar. Replaces
 * `TutorHistorySidebar`. The visual is "Threads"
 * header section + search + grouped-by-time rows
 * (Today / Yesterday / This Week / Older).
 *
 * The collapse state is owned by the parent TutorShell
 * via `useLocalStorage` so a refresh preserves the
 * sidebar's open/closed preference across sessions.
 *
 * We do NOT render the thread subject-grouping the
 * previous sidebar did — time bucketing is more useful
 * for the user's mental model ("today" feels different
 * from "December"). The subject color is still in the
 * row for context.
 */
export function HistoryPanel({
  currentSubjectId,
  currentTopicId,
  collapsed,
  onToggleCollapse,
}: {
  readonly currentSubjectId: Id<"subjects">;
  readonly currentTopicId: Id<"topics"> | null;
  readonly collapsed: boolean;
  readonly onToggleCollapse: () => void;
}) {
  const groups = useQuery(api.tutor.listThreadsForSidebar);
  const [query, setQuery] = useState("");

  // Filter + group by time buckets on the client so we
  // reactively narrow as the user types.
  const filteredBuckets = useMemo(() => groupByTimeBucket(groups, query), [groups, query]);

  if (collapsed) {
    return (
      <aside
        aria-label="Thread history (collapsed)"
        className="flex w-14 shrink-0 flex-col items-center gap-3 rounded-r-2xl border-r border-y border-border bg-surface-elevated/60 py-3"
      >
        <CollapsedRail onToggleCollapse={onToggleCollapse} />
      </aside>
    );
  }

  return (
    <aside
      aria-label="Thread history"
      className="flex w-72 shrink-0 flex-col gap-2.5 rounded-r-2xl border-r border-y border-border bg-surface-elevated/40 px-2 py-3 shadow-[var(--shadow-soft)]"
    >
      <header className="flex items-center justify-between px-2.5">
        <span className="flex items-center gap-2">
          <ChatCircleText
            aria-hidden
            className="h-4 w-4 text-muted-foreground"
            weight="duotone"
          />
          <h2 className="text-[12.5px] font-medium tracking-[-0.005em] text-foreground">
            Threads
          </h2>
        </span>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Collapse thread history"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
        >
          <CaretLeft className="h-3.5 w-3.5" weight="bold" />
        </button>
      </header>

      <div className="relative px-2.5">
        <MagnifyingGlass
          aria-hidden
          className="pointer-events-none absolute left-5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
          weight="duotone"
        />
        <input
          type="search"
          placeholder="Search threads"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search threads"
          className="w-full rounded-md border border-border bg-surface-elevated py-1.5 pl-8 pr-2 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40 transition-colors"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pr-2">
        {groups === undefined ? (
          <SidebarLoading />
        ) : filteredBuckets.length === 0 ? (
          <SidebarEmpty query={query} />
        ) : (
          <div className="flex flex-col gap-3.5">
            {filteredBuckets.map((bucket) => (
              <TimeBucket
                key={bucket.label}
                bucket={bucket}
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

/**
 * CollapsedRail.
 *
 * When the user collapses the sidebar they see a
 * narrow rail with a single "Open" affordance + the
 * total unread chip. The rail is keyboard-accessible
 * (button + aria-label) so a power-user can keep the
 * sidebar collapsed by default without losing access.
 */
function CollapsedRail({ onToggleCollapse }: { readonly onToggleCollapse: () => void }) {
  const groups = useQuery(api.tutor.listThreadsForSidebar);
  const unreadTotal = groups
    ? groups.reduce((acc, g) => acc + g.threads.reduce((s, t) => s + t.unreadCount, 0), 0)
    : 0;
  return (
    <>
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label="Open thread history"
        className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background transition-colors hover:opacity-90"
      >
        <CaretRight className="h-4 w-4" weight="bold" />
      </button>
      {unreadTotal > 0 && (
        <span
          aria-label={`${unreadTotal} unread`}
          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 font-mono text-[9.5px] font-semibold text-accent-foreground"
        >
          {unreadTotal > 9 ? "9+" : unreadTotal}
        </span>
      )}
    </>
  );
}

/**
 * groupByTimeBucket.
 *
 * Pure client-side bucketing. Returns buckets in
 * canonical order: Today, Yesterday, This Week,
 * Older. Empty input (= empty Convex result)
 * returns an empty array so the `SidebarEmpty`
 * branch renders. Each bucket carries the time
 * label + thread rows already filtered by the
 * search query.
 *
 * Convex returns threads sorted by `lastMessageAt`
 * desc within each subject; we re-flatten to an
 * array of `{ thread, subjectRow }` pairs first so
 * the bucket logic works on a single sequence.
 */
export function groupByTimeBucket(
  groups:
    | ReadonlyArray<{
        subject: { id: Id<"subjects">; title: string; slug: string; color: string | null };
        threads: ReadonlyArray<{
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
      }>
    | undefined,
  query: string
): ReadonlyArray<{
  label: string;
  rows: ReadonlyArray<{
    thread: {
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
    subject: { id: Id<"subjects">; title: string; slug: string; color: string | null };
  }>;
}> {
  if (!groups || groups.length === 0) return [];
  const normalized = query.trim().toLowerCase();
  const flat: Array<{
    thread: (typeof groups)[number]["threads"][number];
    subject: (typeof groups)[number]["subject"];
  }> = [];
  for (const g of groups) {
    for (const t of g.threads) {
      const haystack = `${t.title ?? ""} ${t.lastMessagePreview ?? ""}`.toLowerCase();
      if (normalized && !haystack.includes(normalized)) continue;
      flat.push({ thread: t, subject: g.subject });
    }
  }
  if (flat.length === 0) return [];
  flat.sort((a, b) => (b.thread.lastMessageAt ?? b.thread.createdAt) - (a.thread.lastMessageAt ?? a.thread.createdAt));

  const now = Date.now();
  const DAY_MS = 86_400_000;
  const today = Math.floor(now / DAY_MS);
  const yesterday = today - 1;
  const startOfWeek = today - 6;
  const buckets: Array<{ label: string; rows: typeof flat }> = [
    { label: "Today", rows: [] },
    { label: "Yesterday", rows: [] },
    { label: "This week", rows: [] },
    { label: "Older", rows: [] },
  ];
  for (const row of flat) {
    const t = row.thread.lastMessageAt ?? row.thread.createdAt;
    const day = Math.floor(t / DAY_MS);
    if (day === today) buckets[0].rows.push(row);
    else if (day === yesterday) buckets[1].rows.push(row);
    else if (day >= startOfWeek) buckets[2].rows.push(row);
    else buckets[3].rows.push(row);
  }
  return buckets.filter((b) => b.rows.length > 0);
}

/**
 * TimeBucket.
 *
 * Renders one bucket of threads. The bucket label
 * is a small mono-uppercase eyebrow; the rows are
 * subject-tinted thread rows.
 */
function TimeBucket({
  bucket,
  currentSubjectId,
  currentTopicId,
}: {
  readonly bucket: {
    readonly label: string;
    readonly rows: ReadonlyArray<{
      readonly thread: {
        readonly id: Id<"tutorThreads">;
        readonly title: string | null;
        readonly subjectId: Id<"subjects"> | null;
        readonly topicId: Id<"topics"> | null;
        readonly lastReadAt: number | null;
        readonly createdAt: number;
        readonly lastMessageAt: number | null;
        readonly lastMessagePreview: string | null;
        readonly unreadCount: number;
      };
      readonly subject: { readonly id: Id<"subjects">; readonly title: string; readonly slug: string; readonly color: string | null };
    }>;
  };
  readonly currentSubjectId: Id<"subjects">;
  readonly currentTopicId: Id<"topics"> | null;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="px-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {bucket.label}
      </h3>
      <ol className="flex flex-col gap-0.5">
        {bucket.rows.map((row) => (
          <ThreadRow
            key={row.thread.id}
            thread={row.thread}
            subject={row.subject}
            isCurrent={
              row.thread.subjectId === currentSubjectId &&
              (row.thread.topicId ?? null) === (currentTopicId ?? null)
            }
          />
        ))}
      </ol>
    </section>
  );
}

/**
 * ThreadRow.
 *
 * Single thread row. The subject color chip on the
 * left makes a misclick less likely — a glance
 * confirms which subject the thread belongs to.
 */
function ThreadRow({
  thread,
  subject,
  isCurrent,
}: {
  readonly thread: {
    readonly id: Id<"tutorThreads">;
    readonly title: string | null;
    readonly subjectId: Id<"subjects"> | null;
    readonly topicId: Id<"topics"> | null;
    readonly lastReadAt: number | null;
    readonly createdAt: number;
    readonly lastMessageAt: number | null;
    readonly lastMessagePreview: string | null;
    readonly unreadCount: number;
  };
  readonly subject: { readonly id: Id<"subjects">; readonly title: string; readonly slug: string; readonly color: string | null };
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
          "group flex flex-col gap-1 rounded-md px-2 py-1.5 transition-colors",
          isCurrent
            ? "bg-surface-elevated"
            : "hover:bg-surface-elevated"
        )}
      >
        <div className="flex items-start justify-between gap-2.5">
          <span className="flex min-w-0 items-center">
            <span className="truncate text-[12.5px] font-medium text-foreground">
              {thread.title ?? "Thread"}
            </span>
          </span>
          {thread.lastMessageAt ? (
            <span className="shrink-0 text-[10.5px] text-muted-foreground/70">
              {formatRelativeDate(thread.lastMessageAt)}
            </span>
          ) : null}
        </div>
        <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {thread.lastMessagePreview
            ? truncate(thread.lastMessagePreview, 80)
            : "No messages yet."}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] text-muted-foreground/80">
            {subject.title}
          </span>
          {thread.unreadCount > 0 ? (
            <span
              aria-label={`${thread.unreadCount} unread message${thread.unreadCount === 1 ? "" : "s"}`}
              className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold tabular-nums text-accent-foreground"
            >
              {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
            </span>
          ) : thread.lastReadAt ? (
            <Check className="h-3 w-3 text-muted-foreground/50" weight="bold" aria-label="All caught up" />
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function SidebarLoading() {
  return (
    <div className="flex flex-col gap-2 px-2.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5 py-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted/30" />
          <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/20" />
        </div>
      ))}
      <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <Sparkle className="h-2.5 w-2.5 text-accent" weight="fill" />
        Syncing threads
      </p>
    </div>
  );
}

function SidebarEmpty({ query }: { readonly query: string }) {
  if (query.trim().length > 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
        <MagnifyingGlass className="h-6 w-6 text-muted-foreground" weight="duotone" />
        <p className="text-[12.5px] font-medium text-foreground">
          Nothing matches &ldquo;{query}&rdquo;
        </p>
        <p className="max-w-[14rem] text-[11px] text-muted-foreground">
          Try a topic name or a question word from the thread.
        </p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
      <ChatCircleText className="h-7 w-7 text-muted-foreground" weight="duotone" />
      <p className="text-[12.5px] font-medium text-foreground">
        No threads yet
      </p>
      <p className="max-w-[14rem] text-[11px] text-muted-foreground">
        Open a subject or start a session — your threads will land here.
      </p>
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

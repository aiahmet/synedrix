"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CaretRight,
  ListBullets,
} from "@phosphor-icons/react/dist/ssr";
import { resolveColorVar } from "@/lib/utils/subjectColor";

/**
 * TutorTopBar.
 *
 * The top chrome of /tutor. One icon trigger
 * (History, which opens the Threads drawer). The
 * previous Memory, Socratic, and Wrap-up triggers
 * are cut: Memory has no ChatGPT analog, Socratic
 * is a session-mode devtool, and Wrap-up duplicates
 * the chat-column-as-resume-surface idea.
 */
export function TutorTopBar({
  subject,
  subjectColor,
  topic,
  backHref,
  onToggleHistory,
  historyUnreadCount,
}: {
  readonly subject: { readonly slug: string; readonly title: string };
  readonly subjectColor?: string;
  readonly topic?: { readonly slug: string; readonly title: string } | null;
  readonly backHref: string | null;
  readonly onToggleHistory: () => void;
  readonly historyUnreadCount: number;
}) {
  const resolvedBackHref =
    backHref ??
    (topic
      ? `/subjects/${subject.slug}/${topic.slug}`
      : `/subjects/${subject.slug}`);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <Link
        href={resolvedBackHref}
        aria-label="Back"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" weight="bold" />
      </Link>

      <div
        aria-label="Topic context"
        className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[13.5px] font-medium tracking-[-0.005em]"
      >
        <Link
          href={`/subjects/${subject.slug}`}
          className="truncate transition-colors hover:opacity-80"
          style={{ color: resolveColorVar(subjectColor) }}
          title={subject.title}
        >
          {subject.title}
        </Link>
        {topic && (
          <>
            <CaretRight
              aria-hidden
              className="h-3 w-3 shrink-0 text-muted-foreground/60"
              weight="bold"
            />
            <span
              aria-label={topic.title}
              className="truncate text-muted-foreground"
              title={topic.title}
            >
              {topic.title}
            </span>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onToggleHistory}
        aria-label={
          historyUnreadCount > 0
            ? `Threads (${historyUnreadCount} unread)`
            : "Threads"
        }
        className="relative inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
      >
        <ListBullets className="h-4 w-4" weight="duotone" />
        <span className="hidden sm:inline">Threads</span>
        {historyUnreadCount > 0 && (
          <span
            aria-hidden
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 font-mono text-[9.5px] font-semibold tabular-nums text-background"
          >
            {historyUnreadCount > 99 ? "99+" : historyUnreadCount}
          </span>
        )}
      </button>
    </header>
  );
}

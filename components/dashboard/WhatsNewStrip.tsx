import Link from "next/link";

import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { Sparkle } from "@/components/landing/icons";
import { formatRelativeDate } from "@/lib/format/relativeDate";

/**
 * WhatsNewStrip.
 *
 * Plan §4.4: a small dashboard feed of the user's
 * most recent AI-driven curriculum updates (new topics
 * and lesson regenerations). The strip is hidden when
 * the user has no qualifying activity.
 */
export function WhatsNewStrip({
  updates,
}: {
  readonly updates: ReadonlyArray<{
    readonly task: "generateCourseLesson";
    readonly at: number;
    readonly model: string;
    readonly href: string | null;
    readonly headline: string;
  }>;
}) {
  if (updates.length === 0) return null;

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="What's new"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            AI updates
          </span>
        }
      />
      <ul className="flex flex-col divide-y divide-border/60">
        {updates.map((u, i) => {
          const body = (
            <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-subtle/60 text-accent"
                aria-hidden
              >
                <Sparkle className="h-3 w-3" weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-foreground">
                  {u.headline}
                </p>
                <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                  Regenerated ·{" "}
                  {formatRelativeDate(u.at)}
                </p>
              </div>
            </div>
          );
          return (
            <li key={`${u.task}-${u.at}-${i}`}>
              {u.href ? (
                <Link
                  href={u.href}
                  className="block rounded-lg px-1 transition-colors hover:bg-surface"
                >
                  {body}
                </Link>
              ) : (
                <div className="px-1">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </CockpitCard>
  );
}

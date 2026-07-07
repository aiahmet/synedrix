"use client";

import { useMemo } from "react";
import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { ReviewHeader } from "@/components/review/ReviewHeader";
import { ReviewSection } from "@/components/review/ReviewSection";
import { EmptyState } from "@/components/review/EmptyState";
import type { QueueItem } from "@/components/review/types";

export function ReviewCenterClient({
  queuePreloaded,
}: {
  readonly queuePreloaded: Preloaded<typeof api.reviewCenter.getReviewQueue>;
}) {
  const data = usePreloadedQuery(queuePreloaded);

  const sections = useMemo(() => {
    const due: QueueItem[] = [];
    const dueToday: QueueItem[] = [];
    const weak: QueueItem[] = [];
    const packs: QueueItem[] = [];

    for (const item of data.items) {
      if (item.kind === "flashcard" || item.kind === "mistake") {
        if (item.priority >= 0.9) due.push(item);
        else dueToday.push(item);
      } else if (item.kind === "weak_topic") weak.push(item);
      else packs.push(item);
    }

    return { due, dueToday, weak, packs };
  }, [data.items]);

  if (data.items.length === 0) return <EmptyState />;

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <ReviewHeader data={data} />

      {sections.due.length > 0 && (
        <ReviewSection label="Overdue" items={sections.due} tone="var(--subject-french)" />
      )}

      {sections.dueToday.length > 0 && (
        <ReviewSection label="Due today" items={sections.dueToday} />
      )}

      {sections.weak.length > 0 && (
        <ReviewSection label="Weak foundations" items={sections.weak} />
      )}

      {sections.packs.length > 0 && (
        <ReviewSection
          label="Formula &amp; vocabulary packs"
          items={sections.packs}
        />
      )}
    </div>
  );
}

import type { QueueItem } from "./types";
import { ReviewQueueCard } from "./ReviewQueueCard";

export function ReviewSection({
  label,
  items,
  tone,
}: {
  readonly label: string;
  readonly items: readonly QueueItem[];
  readonly tone?: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-[13.5px] font-medium leading-[1.2] tracking-[-0.005em] text-foreground">
        {label}
      </h2>
      <div className="flex flex-col gap-2">
        {items.map((item, idx) => (
          <ReviewQueueCard key={`${item.kind}-${idx}`} item={item} tone={tone} />
        ))}
      </div>
    </section>
  );
}

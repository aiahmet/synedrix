"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { type QueueItem, resolveTone, kindMeta } from "./types";

export function ReviewQueueCard({
  item,
  tone: sectionTone,
}: {
  readonly item: QueueItem;
  readonly tone?: string;
}) {
  const { icon: Icon, label } = kindMeta[item.kind];
  const accentTone = item.subjectColor
    ? resolveTone(item.subjectColor)
    : sectionTone;

  return (
    <Link
      href={item.href}
      className="group flex items-center gap-3 rounded-md border border-border bg-background p-3.5 transition-colors hover:border-border hover:bg-surface"
    >
      <Icon
        className="h-4 w-4 shrink-0"
        style={{ color: accentTone ?? "var(--accent)" }}
        weight="duotone"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-[1.2] tracking-[-0.005em] text-foreground">
          {item.title}
        </p>
        <p className="mt-0.5 truncate text-[12px] leading-relaxed text-muted-foreground">
          {item.subtitle}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {item.count !== null && item.count > 1 && (
          <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
            &times;{item.count}
          </span>
        )}
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        <ArrowRight
          className="h-3.5 w-3.5 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground"
          weight="bold"
        />
      </div>
    </Link>
  );
}

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";
import { Lightning, CircleNotch } from "@phosphor-icons/react/dist/ssr";

const COUNTS = [3, 5, 7] as const;

export function InlinePracticeGenerator({
  subjectSlug,
  chapterSlug,
  topicSlug,
}: {
  readonly subjectSlug: string;
  readonly chapterSlug: string;
  readonly topicSlug: string;
}) {
  const router = useRouter();
  const [count, setCount] = useState<number>(5);
  const [starting, setStarting] = useState(false);

  const onStart = useCallback(() => {
    setStarting(true);
    router.push(
      `/subjects/${subjectSlug}/${chapterSlug}/${topicSlug}/practice?count=${count}`
    );
  }, [router, subjectSlug, chapterSlug, topicSlug, count]);

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Generate practice"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            Stay on this page
          </span>
        }
      />
      <p className="text-[12.5px] leading-relaxed text-muted-foreground mb-4">
        Generate a fresh practice set for this topic. Questions are created on
        the practice page, but you can return here when you finish.
      </p>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {COUNTS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setCount(n)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] font-medium transition-colors ${
              count === n
                ? "border-accent bg-accent-subtle/40 text-accent"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            }`}
          >
            <Lightning className="h-3 w-3" weight={count === n ? "fill" : "duotone"} />
            {n} questions
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {starting ? (
          <>
            <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" />
            Starting...
          </>
        ) : (
          <>
            <Lightning className="h-3.5 w-3.5" weight="duotone" />
            Generate {count} practice questions
          </>
        )}
      </button>
    </CockpitCard>
  );
}

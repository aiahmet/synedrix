"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";
import { Play, ArrowRight } from "@/components/landing/icons";

/**
 * CanonicalPracticeLauncher.
 *
 * CTA card on the topic page that lets the student start
 * the canonical-baseline practice set. Different from the
 * AI-generated practice — this is the same set of questions
 * for every student, shipped with the seed.
 *
 * The launcher receives the *topic* id (not a practice set
 * id) because the underlying `startCanonicalPractice`
 * mutation creates a fresh run against the canonical
 * practice set already seeded for that topic. The prop name
 * is `topicId` to match the mutation's contract.
 */
export function CanonicalPracticeLauncher({
  topicId,
  itemCount,
  subjectSlug,
  chapterSlug,
  topicSlug,
}: {
  readonly topicId: Id<"topics">;
  readonly itemCount: number;
  readonly subjectSlug: string;
  readonly chapterSlug: string;
  readonly topicSlug: string;
}) {
  const router = useRouter();
  const startPractice = useMutation(api.practice.startCanonicalPractice);

  const handleStart = async () => {
    try {
      const result = await startPractice({ topicId });
      router.push(
        `/subjects/${subjectSlug}/${chapterSlug}/${topicSlug}/practice?runId=${result.runId}`
      );
    } catch (e) {
      console.warn("Failed to start canonical practice:", e);
    }
  };

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Baseline practice"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {itemCount} questions
          </span>
        }
      />

      <p className="text-[12.5px] leading-relaxed text-muted-foreground mb-4">
        A hand-written practice set covering the essentials of this topic.
        Same questions for every student — measure yourself against the
        canonical benchmark.
      </p>

      <button
        type="button"
        onClick={handleStart}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
      >
        <Play className="h-4 w-4" weight="fill" />
        Start baseline practice
        <ArrowRight className="h-3.5 w-3.5 opacity-60" weight="bold" />
      </button>
    </CockpitCard>
  );
}

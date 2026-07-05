"use client";

import Link from "next/link";
import { Preloaded, usePreloadedQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { ArrowLeft, Books } from "@/components/landing/icons";
import { TopicHeader } from "@/components/dashboard/TopicHeader";
import { TopicObjectiveList } from "@/components/dashboard/TopicObjectiveList";
import { TopicDepthTabs } from "@/components/dashboard/TopicDepthTabs";
import { PrerequisiteStrip } from "@/components/dashboard/PrerequisiteStrip";
import { CommonMistakesPanel, type PreSeededMistakeEntry } from "@/components/dashboard/CommonMistakesPanel";
import { NextBestTopicCard } from "@/components/dashboard/NextBestTopicCard";
import { AskTutorCta } from "@/components/dashboard/AskTutorCta";
import { TopicFormulaSheet } from "@/components/dashboard/TopicFormulaSheet";
import { TopicVocabularyDeck } from "@/components/dashboard/TopicVocabularyDeck";
import { CanonicalPracticeLauncher } from "@/components/dashboard/CanonicalPracticeLauncher";
import { CanonicalFlashcardDeck } from "@/components/dashboard/CanonicalFlashcardDeck";

/**
 * TopicDetailClient.
 *
 * The only client island on /subjects/[slug]/[chapterSlug]/[topicSlug].
 * Subscribes to the preloaded Convex query
 * `api.subjects.getTopicDetailBySlug`. The query returns `null` for
 * unknown slugs or unauthenticated requests, so the not-found
 * state is rendered here.
 *
 * Composes the cockpit regions in reading order:
 *   1. TopicHeader (breadcrumb + mastery pill + Start-study CTA)
 *   2. TopicObjectiveList (objectives checklist, mastered when
 *      overall topic mastery >= 0.6)
 *   3. TopicDepthTabs — three-depth segmented control
 *      (simple / standard / rigorous) with depth-specific
 *      LessonBlockList panels
 *   4. PrerequisiteStrip + lock hint
 *   5. CommonMistakesPanel
 *   6. NextBestTopicCard + AskTutorCta side-by-side
 *
 * Honors `prefers-reduced-motion` via the global stylesheet rule
 * already in app/globals.css for the synchronized-segment
 * transition, so no per-component opt-out is needed.
 */
export function TopicDetailClient({
  preloaded,
  fallbackSubjectSlug,
  fallbackChapterSlug,
  fallbackTopicSlug,
}: {
  readonly preloaded: Preloaded<typeof api.subjects.getTopicDetailBySlug>;
  readonly fallbackSubjectSlug: string;
  readonly fallbackChapterSlug: string;
  readonly fallbackTopicSlug: string;
}) {
  const data = usePreloadedQuery(preloaded);
  if (!data) {
    return (
      <TopicNotFound
        subjectSlug={fallbackSubjectSlug}
        chapterSlug={fallbackChapterSlug}
        topicSlug={fallbackTopicSlug}
      />
    );
  }

  // Extract pre-seeded mistakes from the standard lesson block.
  const standardBlock = data.lessonBlocks.standard[0];
  const preSeededMistakes: PreSeededMistakeEntry[] | undefined =
    standardBlock?.commonMistakes && standardBlock.commonMistakes.length > 0
      ? standardBlock.commonMistakes
      : undefined;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:gap-7">
      <TopicHeader
        subject={data.subject}
        chapter={data.chapter}
        topic={data.topic}
      />
      <TopicObjectiveList
        objectives={data.topic.objectives}
        mastered={data.topic.mastery >= 0.6}
      />
      <TopicDepthTabs
        simple={data.lessonBlocks.simple}
        standard={data.lessonBlocks.standard}
        rigorous={data.lessonBlocks.rigorous}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-7">
        <div className="flex flex-col gap-6 sm:gap-7 lg:col-span-2">
          <CommonMistakesPanel
            mistakes={data.commonMistakes}
            preSeededMistakes={preSeededMistakes}
          />
          {data.formulaSheet && (
            <TopicFormulaSheet contents={data.formulaSheet.contents} />
          )}
          {data.vocabularyDeck && (
            <TopicVocabularyDeck contents={data.vocabularyDeck.contents} />
          )}
          {data.canonicalPractice && (
            <CanonicalPracticeLauncher
              topicId={data.topic.id}
              itemCount={data.canonicalPractice.itemCount}
              subjectSlug={data.subject.slug}
              chapterSlug={data.chapter.slug}
              topicSlug={data.topic.slug}
            />
          )}
          {data.canonicalFlashcardDeck && (
            <CanonicalFlashcardDeck
              deckId={data.canonicalFlashcardDeck.id}
              title={data.canonicalFlashcardDeck.title}
              cardCount={data.canonicalFlashcardDeck.cardCount}
            />
          )}
        </div>
        <div className="flex flex-col gap-6 sm:gap-7">
          <PrerequisiteStrip
            prerequisites={data.prerequisites}
          />
          <NextBestTopicCard nextBest={data.nextBest} />
          <AskTutorCta
            subject={data.subject}
            topic={data.topic}
            slotId="topic-page-ask-tutor"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Honest 404 for an unknown topic slug. Back-or-subjects card.
 */
function TopicNotFound({
  subjectSlug,
  chapterSlug,
  topicSlug,
}: {
  readonly subjectSlug: string;
  readonly chapterSlug: string;
  readonly topicSlug: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-[var(--shadow-soft)]">
        <div className="rounded-xl bg-background p-7 text-center sm:p-8">
          <span
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--subject-french) 12%, transparent)",
              color: "var(--subject-french)",
            }}
            aria-hidden
          >
            <Books className="h-5 w-5" weight="duotone" />
          </span>
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            Topic not found
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            The path <span className="font-mono">{subjectSlug}</span> /{" "}
            <span className="font-mono">{chapterSlug}</span> /{" "}
            <span className="font-mono">{topicSlug}</span> does not match a
            topic in the curriculum.
          </p>
          <Link
            href={`/subjects/${subjectSlug}/${chapterSlug}`}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to chapter
          </Link>
        </div>
      </div>
    </div>
  );
}


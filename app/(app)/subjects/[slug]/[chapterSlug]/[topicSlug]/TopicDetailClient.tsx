"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Preloaded, usePreloadedQuery, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { ArrowLeft, Books, LockSimple, ChatCircleText } from "@/components/landing/icons";
import { TopicHeader } from "@/components/dashboard/TopicHeader";
import { TopicObjectiveList } from "@/components/dashboard/TopicObjectiveList";
import { TopicDepthTabs } from "@/components/dashboard/TopicDepthTabs";
import { PrerequisiteStrip } from "@/components/dashboard/PrerequisiteStrip";
import { CommonMistakesPanel, type PreSeededMistakeEntry } from "@/components/dashboard/CommonMistakesPanel";
import { NextBestTopicCard } from "@/components/dashboard/NextBestTopicCard";
import { getSubjectBehavior } from "@/lib/ai/subjectBehaviors";
import { TopicFormulaSheet } from "@/components/dashboard/TopicFormulaSheet";
import { TopicVocabularyDeck } from "@/components/dashboard/TopicVocabularyDeck";
import { CanonicalPracticeLauncher } from "@/components/dashboard/CanonicalPracticeLauncher";
import { CanonicalFlashcardDeck } from "@/components/dashboard/CanonicalFlashcardDeck";
import { ConfidenceSlider } from "@/components/dashboard/ConfidenceSlider";
import { TopicNotesPanel } from "@/components/dashboard/TopicNotesPanel";
import { TopicTutorSheet } from "@/components/dashboard/TopicTutorSheet";
import { InlinePracticeGenerator } from "@/components/dashboard/InlinePracticeGenerator";
import { MiniMasteryCheck } from "@/components/dashboard/MiniMasteryCheck";
import { DependedOnByStrip } from "@/components/dashboard/DependedOnByStrip";

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
  const dependedOnBy = useQuery(
    api.subjects.getDependedOnBy,
    data ? { topicId: data.topic.id } : "skip"
  ) ?? [];
  const [tutorSheetOpen, setTutorSheetOpen] = useState(false);

  const lessonContent = useMemo(() => {
    if (!data) return "";
    return data.lessonBlocks.standard
      .map((b) => b.content)
      .join("\n\n");
  }, [data]);

  if (!data) {
    return (
      <TopicNotFound
        subjectSlug={fallbackSubjectSlug}
        chapterSlug={fallbackChapterSlug}
        topicSlug={fallbackTopicSlug}
      />
    );
  }

  const standardBlock = data.lessonBlocks.standard[0];
  const preSeededMistakes: PreSeededMistakeEntry[] | undefined =
    standardBlock?.commonMistakes && standardBlock.commonMistakes.length > 0
      ? standardBlock.commonMistakes
      : undefined;

  const lockedPrereq = data.prerequisites.find((p) => !p.unlocked);

  const resourceHints = getSubjectBehavior(data.subject.slug).resourceHints;

  const skipHref = data.nextBest
    ? `/subjects/${data.nextBest.subject.slug}/${data.nextBest.chapter.slug}/${data.nextBest.topic.slug}`
    : `/subjects/${data.subject.slug}`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:gap-7">
      {lockedPrereq && (
        <PrerequisiteLockBanner
          prereqTitle={lockedPrereq.title}
          prereqHref={`/subjects/${lockedPrereq.subjectSlug}/${lockedPrereq.chapterSlug}/${lockedPrereq.slug}`}
        />
      )}
      <TopicHeader
        subject={data.subject}
        chapter={data.chapter}
        topic={data.topic}
        skipHref={skipHref}
      />

      <ConfidenceSlider
        topicId={data.topic.id}
        confidence={data.topic.confidence}
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
          {data.formulaSheet && resourceHints.includes("formula_sheet") && (
            <TopicFormulaSheet contents={data.formulaSheet.contents} />
          )}
          {data.vocabularyDeck && resourceHints.includes("vocabulary_deck") && (
            <TopicVocabularyDeck contents={data.vocabularyDeck.contents} />
          )}

          <TopicNotesPanel
            topicId={data.topic.id}
            lessonContent={lessonContent}
          />

          {data.canonicalPractice && (
            <CanonicalPracticeLauncher
              topicId={data.topic.id}
              itemCount={data.canonicalPractice.itemCount}
              subjectSlug={data.subject.slug}
              chapterSlug={data.chapter.slug}
              topicSlug={data.topic.slug}
            />
          )}

          <InlinePracticeGenerator
            subjectSlug={data.subject.slug}
            chapterSlug={data.chapter.slug}
            topicSlug={data.topic.slug}
          />

          {data.canonicalFlashcardDeck && (
            <CanonicalFlashcardDeck
              deckId={data.canonicalFlashcardDeck.id}
              title={data.canonicalFlashcardDeck.title}
              cardCount={data.canonicalFlashcardDeck.cardCount}
            />
          )}

          <MiniMasteryCheck
            mastery={data.topic.mastery}
            confidence={data.topic.confidence}
            isStudied={data.topic.isStudied}
          />

          <NextBestTopicCard
            nextBest={data.nextBest}
            variant="post-lesson"
          />
        </div>
        <div className="flex flex-col gap-6 sm:gap-7">
          <PrerequisiteStrip prerequisites={data.prerequisites} />

          <DependedOnByStrip
            topics={dependedOnBy}
          />

          <button
            type="button"
            onClick={() => setTutorSheetOpen(true)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-accent-border/40 bg-accent-subtle/20 text-[12.5px] font-medium text-accent transition-colors hover:bg-accent-subtle/30"
          >
            <ChatCircleText className="h-4 w-4" weight="duotone" />
            Ask the tutor about this topic
          </button>

          <Link
            href={`/tutor?subject=${encodeURIComponent(data.subject.slug)}&topic=${encodeURIComponent(data.topic.slug)}&from=${encodeURIComponent(`/subjects/${data.subject.slug}/${data.chapter.slug}/${data.topic.slug}`)}`}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-elevated text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface"
          >
            Open full tutor page
          </Link>
        </div>
      </div>

      <TopicTutorSheet
        subject={data.subject}
        topic={data.topic}
        initialOpen={tutorSheetOpen}
        onOpenChange={setTutorSheetOpen}
      />
    </div>
  );
}

function PrerequisiteLockBanner({
  prereqTitle,
  prereqHref,
}: {
  readonly prereqTitle: string;
  readonly prereqHref: string;
}) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-subject-french/40 bg-subject-french/10 px-4 py-3"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-subject-french/40 bg-subject-french/15 text-subject-french"
        aria-hidden
      >
        <LockSimple className="h-4 w-4" weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-subject-french">
          Locked
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">
          Finish{" "}
          <Link
            href={prereqHref}
            className="font-semibold text-foreground underline decoration-subject-french/60 underline-offset-2 transition-colors hover:text-subject-french"
          >
            {prereqTitle}
          </Link>{" "}
          first to unlock the rest of this topic.
        </p>
      </div>
    </div>
  );
}

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
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to chapter
          </Link>
        </div>
      </div>
    </div>
  );
}

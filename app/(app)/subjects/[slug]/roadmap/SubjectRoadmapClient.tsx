"use client";

import { Preloaded, usePreloadedQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { SubjectRoadmap } from "@/components/dashboard/SubjectRoadmap";
import { CockpitCard } from "@/components/dashboard/CockpitCard";
import { ArrowLeft, MapTrifold } from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";

export function SubjectRoadmapClient({
  preloaded,
}: {
  readonly preloaded: Preloaded<typeof api.subjects.getHub>;
}) {
  const data = usePreloadedQuery(preloaded);

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl">
        <CockpitCard>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <MapTrifold className="h-5 w-5 text-muted-foreground" weight="duotone" />
            <p className="text-[13px] text-muted-foreground">Subject not found.</p>
            <Link href="/subjects" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-[12.5px] font-medium text-background">
              <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
              Back to subjects
            </Link>
          </div>
        </CockpitCard>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1.5 pt-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/subjects/${data.subject.slug}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
          </Link>
          <span
            className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
            style={{ color: data.subject.color ? resolveColorVar(data.subject.color) : "var(--muted-foreground)" }}
          >
            / subjects / {data.subject.slug} / roadmap
          </span>
        </div>
        <h1 className="text-balance text-[clamp(1.6rem,2.2vw+0.5rem,2rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          {data.subject.title} roadmap
        </h1>
        <p className="max-w-xl text-pretty text-[13px] text-muted-foreground">
          Every chapter and topic in order, with prerequisites, mastery, and the path to grade 12 readiness.
        </p>
      </header>

      <SubjectRoadmap
        chapters={data.chapters.map((ch) => ({
          id: ch.id,
          slug: ch.slug,
          title: ch.title,
          order: ch.order,
          topicCount: ch.topicCount,
          topicsStudied: ch.topicsStudied,
          mastery: ch.mastery,
          lastStudiedAt: ch.lastStudiedAt,
          isCurrent: ch.isCurrent,
          isCompleted: ch.isCompleted,
          description: ch.description,
          topics: ch.topics.map((t) => ({
            id: t.id,
            slug: t.slug,
            title: t.title,
            objectives: t.objectives,
            examRelevance: t.examRelevance,
            difficulty: t.difficulty,
            estimatedMinutes: t.estimatedMinutes,
            mastery: t.mastery,
            confidence: t.confidence,
            lastStudiedAt: t.lastStudiedAt,
            isStudied: t.isStudied,
            source: t.source,
            isUnlocked: t.isUnlocked,
            prerequisites: t.prerequisites.map((p) => ({
              id: p.id,
              slug: p.slug,
              title: p.title,
              chapterSlug: p.chapterSlug,
              subjectSlug: p.subjectSlug,
              mastery: p.mastery,
              isStudied: p.isStudied,
              unlocked: p.unlocked,
            })),
          })),
        }))}
        subjectSlug={data.subject.slug}
        subjectColor={data.subject.color}
      />
    </div>
  );
}

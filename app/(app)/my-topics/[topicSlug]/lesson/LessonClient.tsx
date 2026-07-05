"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import {
  CockpitCard,
  CockpitCardHeader,
} from "@/components/dashboard/CockpitCard";
import {
  ArrowLeft,
  Books,
  CheckCircle,
  PlayCircle,
  Sparkle,
  User,
  WarningCircle,
} from "@/components/landing/icons";
import { AIMarkdown } from "@/lib/content/aiMarkdown";

/**
 * LessonClient.
 *
 * The lesson view for a student-created topic.
 * Server-side ownership resolution happens via
 * `api.topics.getOwnedTopicBySlug` (the Clerk JWT
 * propagates through the convex client). When the
 * query returns the topic, we render the lesson sections
 * + glossary + the "Regenerate lesson" CTA + the "Start
 * practice" CTA.
 */
export function LessonClient({
  topicSlug,
}: {
  readonly topicSlug: string;
}) {
  const router = useRouter();
  const topic = useQuery(api.topics.getOwnedTopicBySlug, { slug: topicSlug });
  const lesson = useQuery(
    api.topics.getTopicLesson,
    topic ? { topicId: topic.id } : "skip"
  );

  if (topic === undefined || lesson === undefined) {
    return <LessonSkeleton />;
  }

  if (topic === null) {
    return (
      <CockpitCard>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--subject-physics) 14%, transparent)",
              color: "var(--subject-physics)",
            }}
            aria-hidden
          >
            <Books className="h-5 w-5" weight="duotone" />
          </span>
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            No topic matches &ldquo;{topicSlug}&rdquo;
          </h2>
          <p className="max-w-md text-[12.5px] text-muted-foreground">
            This topic is either not in your account, owned by
            someone else, or is a canonical curriculum topic.
            Student-created topics land here.
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/my-topics"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-all hover:opacity-90 active:scale-[0.98]"
            >
              <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
              Back to your topics
            </Link>
            <Link
              href="/subjects"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Browse subjects
            </Link>
          </div>
        </div>
      </CockpitCard>
    );
  }

  const onStartPractice = () => {
    router.push(`/my-topics/${topic.slug}/practice`);
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5"
      >
        <Link
          href="/my-topics"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated/60 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm transition-colors hover:border-accent-border/60 hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" weight="bold" />
          Your topics
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <Link
          href={`/subjects/${topic.subjectSlug}/${topic.chapterSlug}`}
          className="rounded-full bg-accent-subtle/40 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent"
        >
          Chapter context
        </Link>
      </nav>

      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--subject-chemistry) 12%, transparent)",
                borderColor:
                  "color-mix(in srgb, var(--subject-chemistry) 30%, transparent)",
              }}
              aria-hidden
            >
              <User
                className="h-6 w-6"
                weight="duotone"
                style={{ color: "var(--subject-chemistry)" }}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em]"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--subject-chemistry) 10%, transparent)",
                    borderColor:
                      "color-mix(in srgb, var(--subject-chemistry) 28%, transparent)",
                    color: "var(--subject-chemistry)",
                  }}
                >
                  my topic
                </span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                  grade {topic.gradeLevel ?? "—"} · {topic.difficulty}
                </span>
              </div>
              <h1 className="mt-1.5 text-balance text-[clamp(1.5rem,2vw+0.5rem,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
                {topic.title}
              </h1>
              {topic.objectives.length > 0 && (
                <p className="mt-2 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
                  {topic.objectives.length} objective
                  {topic.objectives.length === 1 ? "" : "s"} on the lesson.
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onStartPractice}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground shadow-[var(--shadow-soft)] transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <PlayCircle className="h-3.5 w-3.5" weight="duotone" />
            Start practice
          </button>
        </div>
      </header>

      {lesson === null ? (
        <EmptyLesson onStartPractice={onStartPractice} />
      ) : !lesson.schemaValid ? (
        <DegradedLesson />
      ) : (
        <LessonBody lesson={lesson} />
      )}
    </div>
  );
}

function LessonSkeleton() {
  return (
    <CockpitCard>
      <CockpitCardHeader label="Lesson" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-4 w-40 animate-pulse rounded-md bg-muted/40" />
            <div className="h-3 w-full animate-pulse rounded bg-muted/30" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted/30" />
          </div>
        ))}
      </div>
    </CockpitCard>
  );
}

function EmptyLesson({
  onStartPractice,
}: {
  readonly onStartPractice: () => void;
}) {
  return (
    <CockpitCard>
      <CockpitCardHeader label="Lesson" />
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--subject-physics) 14%, transparent)",
            color: "var(--subject-physics)",
          }}
          aria-hidden
        >
          <Books className="h-5 w-5" weight="duotone" />
        </span>
        <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
          No lesson generated yet.
        </h2>
        <p className="max-w-md text-[12.5px] text-muted-foreground">
          We could not find a generated lesson for this topic. Try
          regenerating from the chapter page — the tutor will
          write a fresh take.
        </p>
        <button
          type="button"
          onClick={onStartPractice}
          className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-all hover:opacity-90 active:scale-[0.98]"
        >
          <Sparkle className="h-3.5 w-3.5" weight="duotone" />
          Try starting practice
        </button>
      </div>
    </CockpitCard>
  );
}

function DegradedLesson() {
  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Lesson"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-subject-french">
            Fallback
          </span>
        }
      />
      <p className="flex items-start gap-2 rounded-lg border border-subject-french/30 bg-subject-french/10 px-3 py-2 text-[12.5px] leading-relaxed text-subject-french">
        <WarningCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="bold" />
        The tutor could not return a structured lesson. We
        wrote a degraded row so you can still navigate to
        practice; the next Regenerate will write a fresh
        take.
      </p>
    </CockpitCard>
  );
}

function LessonBody({
  lesson,
}: {
  readonly lesson: {
    readonly sections: ReadonlyArray<{ heading: string; body: string }>;
    readonly glossary: ReadonlyArray<{ term: string; definition: string }>;
    readonly version: number;
    readonly wordCount: number;
  };
}) {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <CockpitCard>
        <CockpitCardHeader
          label="Lesson"
          trailing={
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              v{lesson.version} · {lesson.wordCount} words
            </span>
          }
        />
        <div className="flex flex-col gap-6">
          {lesson.sections.map((s, i) => (
            <article key={i} className="flex flex-col gap-2">
              <h2 className="text-[16px] font-semibold tracking-[-0.015em] text-foreground">
                {s.heading}
              </h2>
              {/* AI-generated body now flows through
                  AIMarkdown so KaTeX math, bold/italic, and
                  inline code all render. See lesson.ts prompt
                  for the exact delimiter conventions the
                  model is taught to use. The `id` ties the
                  per-block memoization keys to the lesson
                  version + section index, which is the
                  smallest stable surface across renders —
                  the parent LessonBody component is mounted
                  once per lesson load, so `i` survives all
                  unrelated parent re-renders (`topic` query
                  revalidations, mastery ticks, etc.). */}
              <AIMarkdown
                id={`lesson-v${lesson.version}-s${i}`}
                content={s.body}
                density="prose"
              />
            </article>
          ))}
        </div>
      </CockpitCard>

      {lesson.glossary.length > 0 && (
        <CockpitCard>
          <CockpitCardHeader label="Glossary" />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {lesson.glossary.map((g, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <dt className="text-[12.5px] font-semibold tracking-tight text-foreground">
                  {g.term}
                </dt>
                <dd className="text-[12px] leading-relaxed text-muted-foreground">
                  {g.definition}
                </dd>
              </div>
            ))}
          </dl>
        </CockpitCard>
      )}

      <CockpitCard>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-accent" weight="bold" />
          <p className="text-[12.5px] text-muted-foreground">
            You&apos;ve read the lesson. Hit <b>Start practice</b> to
            answer 5 open-prose questions and get a per-question grade
            review.
          </p>
        </div>
      </CockpitCard>
    </div>
  );
}

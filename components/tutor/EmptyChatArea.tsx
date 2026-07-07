"use client";

import Link from "next/link";
import { Target, ArrowRight } from "@phosphor-icons/react";
import type { Id } from "@/convex/_generated/dataModel";

type TopicSuggestion = {
  id: Id<"topics">;
  slug: string;
  title: string;
  chapterSlug: string;
  chapterTitle: string;
  mastery: number;
  isStudied: boolean;
  examRelevance: number;
};

export function EmptyChatArea({
  state,
  topicSuggestions,
  subject,
}: {
  readonly state: "loading" | "new_thread" | "subject_only";
  readonly topicSuggestions?: readonly TopicSuggestion[] | null;
  readonly subject?: {
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
  } | null;
}) {
  // Loading state — skeleton placeholder
  if (state === "loading") {
    return (
      <div className="flex-1 py-6 space-y-3">
        <div className="h-7 w-3/4 animate-pulse rounded bg-muted/30" />
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-muted/20" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted/20" />
          <div className="h-4 w-4/6 animate-pulse rounded bg-muted/20" />
        </div>
      </div>
    );
  }

  // New thread — welcome + topic picker chips
  if (state === "new_thread" || state === "subject_only") {
    return (
      <div className="flex-1 py-8">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Target className="h-6 w-6" weight="duotone" />
          </span>
          <h2 className="mt-4 text-[16px] font-semibold tracking-tight text-foreground">
            {subject
              ? `Ready to study ${subject.title}`
              : "What would you like to learn?"}
          </h2>
          <p className="mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            {state === "new_thread"
              ? "Pick a topic below or ask me anything about this subject."
              : "Choose a topic to get started with a focused tutoring session."}
          </p>

          {/* Topic picker chips */}
          {topicSuggestions && topicSuggestions.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-lg">
              {topicSuggestions.slice(0, 8).map((topic) => {
                const masteryPct = Math.round(topic.mastery * 100);
                const href = subject
                  ? `/subjects/${subject.slug}/${topic.chapterSlug}/${topic.slug}`
                  : "#";
                return (
                  <Link
                    key={topic.id}
                    href={href}
                    className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:border-accent-border/60 hover:bg-accent-subtle/10 hover:text-accent"
                  >
                    {/* Mastery ring */}
                    <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                      <svg className="h-full w-full -rotate-90" viewBox="0 0 16 16">
                        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/20" />
                        <circle
                          cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5"
                          strokeDasharray={`${masteryPct * 0.44} 44`}
                          className={masteryPct >= 85 ? "text-accent" : masteryPct >= 50 ? "text-amber-400" : "text-muted-foreground/50"}
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <span>{topic.title}</span>
                    {/* Exam relevance badge */}
                    {topic.examRelevance >= 4 && (
                      <span className="rounded-full bg-accent/10 px-1.5 py-0.5 font-mono text-[9.5px] font-medium text-accent">
                        HIGH
                      </span>
                    )}
                    <ArrowRight className="h-3 w-3 text-muted-foreground/30 transition-colors group-hover:text-accent" weight="bold" />
                  </Link>
                );
              })}
            </div>
          )}

          {/* Fallback when no topic suggestions */}
          {(!topicSuggestions || topicSuggestions.length === 0) && (
            <p className="mt-4 text-[12px] text-muted-foreground/60">
              Type a question below to start your session.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Fallback (shouldn't happen)
  return <div className="flex-1" />;
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ArenaMode, ArenaQuestionType } from "@/lib/ai/prompts/practiceArena";
import { getSubjectBehavior } from "@/lib/ai/subjectBehaviors";
import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";
import { Sparkle, Target, Timer, ClockCounterClockwise, Notepad, Gauge } from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";

interface SubjectSummary {
  readonly id: Id<"subjects">;
  readonly slug: string;
  readonly title: string;
  readonly color?: string;
  readonly enrolled: boolean;
  readonly topicCount: number;
}

const DIFFICULTIES: { value: "EASY" | "MEDIUM" | "HARD"; label: string; description: string }[] = [
  { value: "EASY", label: "Easy", description: "Accessible questions focused on core recall and basic application." },
  { value: "MEDIUM", label: "Medium", description: "Standard Gymnasium-level questions probing real understanding." },
  { value: "HARD", label: "Hard", description: "Synthesis, deeper reasoning, and multi-step application." },
];

const ALL_QUESTION_TYPES: { value: ArenaQuestionType; label: string }[] = [
  { value: "user_text_answer", label: "Open prose" },
  { value: "mcq", label: "Multiple choice" },
  { value: "fill_blank", label: "Fill in the blank" },
  { value: "step_problem", label: "Step-by-step" },
  { value: "essay_analysis", label: "Essay analysis" },
  { value: "translation_drill", label: "Translation drill" },
  { value: "formula_derivation", label: "Formula derivation" },
  { value: "oral_recall", label: "Oral recall" },
];

const MODES: { value: ArenaMode; label: string; description: string; supportsMultiTopic: boolean; Icon: typeof Target }[] = [
  { value: "sequential", label: "Sequential", description: "One question at a time with immediate feedback.", supportsMultiTopic: false, Icon: Target },
  { value: "timed", label: "Timed", description: "Answer as many as you can before the clock runs out.", supportsMultiTopic: false, Icon: Timer },
  { value: "retry_wrong", label: "Retry Wrong", description: "Review mistakes from your last session and retry them.", supportsMultiTopic: false, Icon: ClockCounterClockwise },
  { value: "exam_simulation", label: "Exam Simulation", description: "No feedback until the end. Real exam conditions.", supportsMultiTopic: true, Icon: Notepad },
];

export function ConfigPanel({
  subjects,
  onStart,
  errorMsg,
  subjectSlug,
}: {
  readonly subjects: readonly SubjectSummary[];
  readonly onStart: (config: {
    topicIds: string[];
    mode: ArenaMode;
    timeLimitSec?: number;
    itemCount: number;
    questionTypes: ArenaQuestionType[];
    difficulty: "EASY" | "MEDIUM" | "HARD";
    subjectSlug?: string;
  }) => void;
  readonly errorMsg: string | null;
  readonly subjectSlug?: string;
}) {
  const enrolled = useMemo(
    () => subjects.filter((s) => s.enrolled),
    [subjects]
  );

  const [selectedSubjectId, setSelectedSubjectId] = useState<Id<"subjects"> | null>(
    () => enrolled[0]?.id ?? null
  );
  const [mode, setMode] = useState<ArenaMode>("sequential");
  const [itemCount, setItemCount] = useState(5);
  const [timeLimitMin, setTimeLimitMin] = useState(5);
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<Id<"topics">>>(
    () => new Set()
  );

  const selectedSubject = enrolled.find((s) => s.id === selectedSubjectId);

  const questionTypesInitialized = useRef(false);
  const [questionTypes, setQuestionTypes] = useState<ArenaQuestionType[]>([
    "user_text_answer",
    "mcq",
    "fill_blank",
    "step_problem",
    "essay_analysis",
    "translation_drill",
    "formula_derivation",
    "oral_recall",
  ]);

  useEffect(() => {
    if (questionTypesInitialized.current) return;
    const slug = subjectSlug ?? selectedSubject?.slug;
    if (!slug) return;
    questionTypesInitialized.current = true;
    const behavior = getSubjectBehavior(slug);
    const preferred = behavior.preferredQuestionTypes.filter(
      (t): t is ArenaQuestionType =>
        ALL_QUESTION_TYPES.some((qt) => qt.value === t)
    );
    if (preferred.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuestionTypes(preferred);
    }
  }, [subjectSlug, selectedSubject?.slug]);
  const isMultiTopic = mode === "exam_simulation";

  const topicsForSubject = useQuery(
    api.practiceArena.listTopicsForSubject,
    selectedSubjectId ? { subjectId: selectedSubjectId } : "skip"
  );

  const handleStart = () => {
    if (!selectedSubject) return;
    const topicIds = Array.from(selectedTopicIds).map(String);
    if (topicIds.length === 0) return;
    onStart({
      topicIds,
      mode,
      timeLimitSec: mode === "timed" ? timeLimitMin * 60 : undefined,
      itemCount,
      questionTypes,
      difficulty,
      subjectSlug: selectedSubject?.slug,
    });
  };

  const toggleQuestionType = (t: ArenaQuestionType) => {
    setQuestionTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const toggleTopic = (id: Id<"topics">) => {
    setSelectedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!isMultiTopic) {
          next.clear();
        }
        next.add(id);
      }
      return next;
    });
  };

  const groupedTopics = useMemo(() => {
    if (!topicsForSubject) return [];
    const groups = new Map<Id<"chapters">, { chapterTitle: string; topics: typeof topicsForSubject }>();
    for (const t of topicsForSubject) {
      const existing = groups.get(t.chapterId);
      if (existing) {
        existing.topics.push(t);
      } else {
        groups.set(t.chapterId, { chapterTitle: t.chapterTitle, topics: [t] });
      }
    }
    return Array.from(groups.values());
  }, [topicsForSubject]);

  return (
    <div className="flex flex-col gap-6">
      {errorMsg && (
        <div className="rounded-lg border border-subject-french/30 bg-subject-french/10 px-4 py-3 text-[12px] text-subject-french">
          {errorMsg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <CockpitCard>
          <CockpitCardHeader label="Subject" />
          <div className="flex flex-col gap-2">
            {enrolled.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                Enroll in a subject to start practicing.
              </p>
            ) : (
              enrolled.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedSubjectId(s.id);
                    setSelectedTopicIds(new Set());
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-[13px] font-medium transition-colors hover:bg-surface",
                    selectedSubjectId === s.id &&
                      "border-accent bg-accent-subtle/40 text-foreground"
                  )}
                >
                  <span className="text-[12.5px]">{s.title}</span>
                  <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                    {s.topicCount} topics
                  </span>
                </button>
              ))
            )}
          </div>
        </CockpitCard>

        <CockpitCard>
          <CockpitCardHeader label="Mode" />
          <div className="flex flex-col gap-2">
            {MODES.map((m) => {
              const isActive = mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    setMode(m.value);
                    if (!m.supportsMultiTopic) {
                      setSelectedTopicIds(new Set());
                    }
                  }}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-surface",
                    isActive && "border-accent bg-accent-subtle/40"
                  )}
                >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "border border-border text-muted-foreground"
                  )}
                >
                  {isActive ? (
                    <span className="text-[10px] font-bold">✓</span>
                  ) : (
                    <m.Icon className="h-3 w-3" weight="duotone" />
                  )}
                </span>
                  <div>
                    <span className="text-[13px] font-medium text-foreground">
                      {m.label}
                    </span>
                    <p className="text-[11.5px] text-muted-foreground">
                      {m.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </CockpitCard>
      </div>

      <CockpitCard>
        <CockpitCardHeader label="Difficulty" />
        <div className="flex flex-col gap-2">
          {DIFFICULTIES.map((d) => {
            const isActive = difficulty === d.value;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => setDifficulty(d.value)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-surface",
                  isActive && "border-accent bg-accent-subtle/40"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "border border-border text-muted-foreground"
                  )}
                >
                  {isActive ? (
                    <span className="text-[10px] font-bold">✓</span>
                  ) : (
                    <Gauge className="h-3 w-3" weight="duotone" />
                  )}
                </span>
                <div>
                  <span className="text-[13px] font-medium text-foreground">
                    {d.label}
                  </span>
                  <p className="text-[11.5px] text-muted-foreground">
                    {d.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </CockpitCard>

      {selectedSubject && (
        <CockpitCard>
          <CockpitCardHeader
            label={isMultiTopic ? "Topics (select multiple)" : "Topic (select one)"}
          />
          {!topicsForSubject ? (
            <p className="text-[12.5px] text-muted-foreground">Loading topics...</p>
          ) : groupedTopics.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">
              No topics available for this subject.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {groupedTopics.map((group) => (
                <div key={group.chapterTitle}>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                    {group.chapterTitle}
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {group.topics.map((topic) => {
                      const active = selectedTopicIds.has(topic.id);
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => toggleTopic(topic.id)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors",
                            active
                              ? "border-accent bg-accent-subtle/40 text-accent"
                              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                          )}
                        >
                          {topic.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CockpitCard>
      )}

      <CockpitCard>
        <CockpitCardHeader label="Question count" />
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={3}
            max={8}
            value={itemCount}
            onChange={(e) => setItemCount(Number(e.target.value))}
            className="h-1.5 w-full max-w-[16rem] appearance-none rounded-full bg-surface accent-accent"
          />
          <span className="font-mono text-[13px] tabular-nums text-foreground">
            {itemCount}
          </span>
        </div>
      </CockpitCard>

      {mode === "timed" && (
        <CockpitCard>
          <CockpitCardHeader label="Time limit" />
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={30}
              value={timeLimitMin}
              onChange={(e) => setTimeLimitMin(Number(e.target.value))}
              className="h-1.5 w-full max-w-[16rem] appearance-none rounded-full bg-surface accent-accent"
            />
            <span className="font-mono text-[13px] tabular-nums text-foreground">
              {timeLimitMin} min
            </span>
          </div>
        </CockpitCard>
      )}

      <CockpitCard>
        <CockpitCardHeader label="Question types" />
        <div className="flex flex-wrap gap-2">
          {ALL_QUESTION_TYPES.map((qt) => {
            const active = questionTypes.includes(qt.value);
            return (
              <button
                key={qt.value}
                type="button"
                onClick={() => toggleQuestionType(qt.value)}
                disabled={active && questionTypes.length <= 1}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors",
                  active
                    ? "border-accent bg-accent-subtle/40 text-accent"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  active && questionTypes.length <= 1 && "cursor-not-allowed opacity-50"
                )}
              >
                {qt.label}
              </button>
            );
          })}
        </div>
      </CockpitCard>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleStart}
          disabled={
            !selectedSubject ||
            selectedTopicIds.size === 0 ||
            enrolled.length === 0
          }
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-5 text-[12.5px] font-medium text-accent-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkle className="h-3.5 w-3.5" weight="duotone" />
          Start practice
        </button>
      </div>
    </div>
  );
}

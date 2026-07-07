"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Preloaded, usePreloadedQuery, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ArenaMode, ArenaQuestionType } from "@/lib/ai/prompts/practiceArena";
import { ConfigPanel } from "@/components/practice/ConfigPanel";
import { PracticeRunner } from "@/components/practice/PracticeRunner";
import { SummaryView } from "@/components/practice/SummaryView";
import { CockpitCard } from "@/components/dashboard/CockpitCard";

export interface GradeResponse {
  readonly attemptId: string | null;
  readonly verdict: "correct" | "partially_correct" | "incorrect";
  readonly score: number;
  readonly feedback: string;
  readonly betterAnswer: string;
  readonly mistakeEntryId: string | null;
  readonly degraded?: boolean;
}

type Phase =
  | "config"
  | "starting"
  | "running"
  | "finishing"
  | "summary"
  | "error";

export function PracticeArenaClient({
  subjectsPreloaded,
}: {
  readonly subjectsPreloaded: Preloaded<typeof api.subjects.list>;
}) {
  const subjects = usePreloadedQuery(subjectsPreloaded);
  const searchParams = useSearchParams();
  const preselectedTopicId = searchParams.get("topicId");

  const preselectedSubjectSlug = useQuery(
    api.practiceArena.getSubjectSlugForTopic,
    preselectedTopicId
      ? { topicId: preselectedTopicId as Id<"topics"> }
      : "skip"
  );

  const [phase, setPhase] = useState<Phase>("config");
  const [runId, setRunId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [examGrades, setExamGrades] = useState<
    Map<string, GradeResponse> | undefined
  >(undefined);
  const [selectedSubjectSlug, setSelectedSubjectSlug] = useState<string | undefined>(undefined);
  const [autoStartAttempted, setAutoStartAttempted] = useState(false);
  const preselectedSubjectSlugRef = useRef(preselectedSubjectSlug);
  useEffect(() => {
    preselectedSubjectSlugRef.current = preselectedSubjectSlug;
  }, [preselectedSubjectSlug]);

  const handleStart = useCallback(
    async (config: {
      topicIds: string[];
      mode: ArenaMode;
      timeLimitSec?: number;
      itemCount: number;
      questionTypes: ArenaQuestionType[];
      difficulty: "EASY" | "MEDIUM" | "HARD";
      subjectSlug?: string;
    }) => {
      setPhase("starting");
      setErrorMsg(null);
      setSelectedSubjectSlug(config.subjectSlug);

      try {
        const res = await fetch("/api/practice/arena/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setErrorMsg(
            body.error === "ai_failed"
              ? "KI-Generierung fehlgeschlagen. Versuche es gleich noch einmal."
              : `Übung konnte nicht gestartet werden (${res.status}).`
          );
          setPhase("config");
          return;
        }

        const data = (await res.json()) as {
          runId: string;
          itemIds: string[];
        };

        setRunId(data.runId);
        setPhase("running");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Netzwerkfehler");
        setPhase("config");
      }
    },
    []
  );

  useEffect(() => {
    if (!preselectedTopicId || phase !== "config" || autoStartAttempted) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoStartAttempted(true);
    void handleStart({
      topicIds: [preselectedTopicId],
      mode: "sequential",
      timeLimitSec: undefined,
      itemCount: 5,
      questionTypes: [
        "user_text_answer",
        "mcq",
        "fill_blank",
        "step_problem",
        "essay_analysis",
        "translation_drill",
        "formula_derivation",
        "oral_recall",
      ],
      difficulty: "MEDIUM",
      subjectSlug: preselectedSubjectSlugRef.current ?? undefined,
    });
  }, [preselectedTopicId, phase, autoStartAttempted, handleStart]);

  const handleFinish = useCallback(
    (grades?: Map<string, GradeResponse>) => {
      setExamGrades(grades);
      setPhase("summary");
    },
    []
  );

  const handleRetryWrong = useCallback(
    async (wrongItemIds: string[]) => {
      if (!runId || wrongItemIds.length === 0) return;
      setPhase("starting");
      setErrorMsg(null);
      setExamGrades(undefined);

      try {
        const res = await fetch("/api/practice/arena/retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentRunId: runId, wrongItemIds }),
        });

        if (!res.ok) {
          setErrorMsg(`Wiederholung fehlgeschlagen (${res.status}).`);
          setPhase("config");
          return;
        }

        const result = (await res.json()) as { runId: string };
        setRunId(result.runId);
        setPhase("running");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Fehler bei der Wiederholung");
        setPhase("config");
      }
    },
    [runId]
  );

  const handleReset = useCallback(() => {
    setPhase("config");
    setRunId(null);
    setErrorMsg(null);
    setExamGrades(undefined);
    setAutoStartAttempted(false);
  }, []);

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <header>
        <h1 className="text-balance text-[clamp(1.5rem,2vw+0.5rem,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          Übungsarena
        </h1>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          {preselectedTopicId && !autoStartAttempted
            ? "Starte eine schnelle Übungseinheit für dein Thema..."
            : "Konfiguriere eine eigene Übungseinheit über Fächer, Modi und Aufgabentypen hinweg."}
        </p>
      </header>

      {phase === "config" && (
        <ConfigPanel
          subjects={subjects}
          onStart={handleStart}
          errorMsg={errorMsg}
          subjectSlug={preselectedSubjectSlug ?? undefined}
        />
      )}

      {phase === "starting" && (
        <CockpitCard>
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span className="text-[13px] text-muted-foreground">
              Generiere Übungsaufgaben...
            </span>
          </div>
        </CockpitCard>
      )}

      {phase === "running" && runId && (
        <PracticeRunner runId={runId} onFinish={handleFinish} subjectSlug={selectedSubjectSlug} />
      )}

      {phase === "summary" && runId && (
        <SummaryView
          runId={runId}
          onReset={handleReset}
          onRetryWrong={handleRetryWrong}
          examGrades={examGrades}
        />
      )}

      {phase === "error" && (
        <CockpitCard>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-[12.5px] text-muted-foreground">
              {errorMsg ?? "Ein unerwarteter Fehler ist aufgetreten."}
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Zurück zur Konfiguration
            </button>
          </div>
        </CockpitCard>
      )}
    </div>
  );
}

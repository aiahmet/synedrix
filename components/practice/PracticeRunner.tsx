"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  CockpitCard,
  CockpitCardHeader,
} from "@/components/dashboard/CockpitCard";
import {
  ArrowRight,
  Check,
  CheckCircle,
  CircleNotch,
  Sparkle,
  Timer,
  WarningCircle,
  X,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { AIMarkdown } from "@/lib/content/aiMarkdown";
import { MathInput } from "@/components/practice/MathInput";
import { getSubjectCategory, type PracticeItemType } from "@/lib/ai/subjectBehaviors";

const ARENA_GRADEABLE_TYPES = new Set([
  "essay_analysis",
  "translation_drill",
  "formula_derivation",
  "oral_recall",
  "mcq",
  "fill_blank",
  "step_problem",
]);

interface GradeResponse {
  readonly attemptId: string | null;
  readonly verdict: "correct" | "partially_correct" | "incorrect";
  readonly score: number;
  readonly feedback: string;
  readonly betterAnswer: string;
  readonly mistakeEntryId: string | null;
  readonly degraded?: boolean;
}

type Phase =
  | "loading"
  | "answering"
  | "grading"
  | "graded"
  | "finishing"
  | "summary"
  | "error";

export function PracticeRunner({
  runId,
  onFinish,
  subjectSlug,
}: {
  readonly runId: string;
  readonly onFinish: (examGrades?: Map<string, GradeResponse>) => void;
  readonly subjectSlug?: string;
}) {
  const run = useQuery(
    api.practiceArena.getArenaRun,
    { runId: runId as Id<"topicLessonPractice"> }
  );
  const items = useQuery(
    api.practiceArena.getArenaRunItems,
    { runId: runId as Id<"topicLessonPractice"> }
  );

  const finishArenaPractice = useMutation(
    api.practiceArena.finishArenaPractice
  );

  const [phase, setPhase] = useState<Phase>("loading");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [grade, setGrade] = useState<GradeResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isExamMode = run?.mode === "exam_simulation";
  const isTimedMode = run?.mode === "timed";
  const timeLimitSec = run?.timeLimitSec ?? null;

  const [timeUp, setTimeUp] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const examAnswersRef = useRef<Map<string, string>>(new Map());
  const examGradesRef = useRef<Map<string, GradeResponse>>(new Map());
  const [examBulkPhase, setExamBulkPhase] = useState<
    { graded: number; total: number } | null
  >(null);

  const orderedItems = useMemo(() => {
    if (!items) return [];
    let filtered = [...items];
    if (run?.wrongItemIds && run.wrongItemIds.length > 0) {
      const wrongSet = new Set(run.wrongItemIds);
      filtered = filtered.filter((i) => wrongSet.has(i.itemId));
    }
    return filtered.sort((a, b) => a.order - b.order);
  }, [items, run]);

  const total = orderedItems.length;

  const arenaTypeSet = ARENA_GRADEABLE_TYPES;

  const onFinishRun = useCallback(async (examGrades?: Map<string, GradeResponse>) => {
    if (!runId) return;
    setPhase("finishing");
    try {
      await finishArenaPractice({ runId: runId as Id<"topicLessonPractice"> });
      onFinish(examGrades);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Finish failed");
      setPhase("answering");
    }
  }, [runId, finishArenaPractice, onFinish]);

  const currentAnswerRef = useRef(currentAnswer);
  const orderedItemsRef = useRef(orderedItems);
  const currentIndexRef = useRef(currentIndex);
  const onFinishRunRef = useRef(onFinishRun);

  useEffect(() => {
    currentAnswerRef.current = currentAnswer;
  }, [currentAnswer]);
  useEffect(() => {
    orderedItemsRef.current = orderedItems;
  }, [orderedItems]);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  useEffect(() => {
    onFinishRunRef.current = onFinishRun;
  }, [onFinishRun]);

  const autoSubmitTimer = useCallback(async () => {
    const answer = currentAnswerRef.current;
    const itemsList = orderedItemsRef.current;
    const idx = currentIndexRef.current;
    const item = itemsList[idx];
    if (!item) {
      void onFinishRunRef.current();
      return;
    }
    if (answer.trim().length > 0) {
      setPhase("grading");
      setErrorMsg("Time's up — answer submitted");
      try {
        const gradeEndpoint = arenaTypeSet.has(item.type)
          ? "/api/practice/arena/grade"
          : "/api/topics/practice/grade";
        await fetch(gradeEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId,
            itemId: item.itemId,
            userAnswer: answer.trim(),
          }),
        });
      } catch {
        // Continue to finish.
      }
    }
    void onFinishRunRef.current();
  }, [runId, arenaTypeSet]);

  useEffect(() => {
    if (!isTimedMode || !timeLimitSec || !run) return undefined;
    const elapsed = Math.floor((Date.now() - run.startedAt) / 1000);
    const remaining = Math.max(0, timeLimitSec - elapsed);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeRemaining(remaining);

    const id = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    timerRef.current = id;

    return () => {
      clearInterval(id);
      timerRef.current = null;
    };
  }, [isTimedMode, timeLimitSec, run]);

  useEffect(() => {
    if (timeRemaining === 0 && phase === "answering" && runId && !timeUp) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeUp(true);
      if (timerRef.current) clearInterval(timerRef.current);
      void autoSubmitTimer();
    }
  }, [timeRemaining, phase, runId, timeUp, autoSubmitTimer]);

  useEffect(() => {
    if (!run) return;
    if (phase !== "loading") return;
    if (run === undefined || items === undefined) return;
    if (run.status === "graded") {
      onFinish();
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("answering");
  }, [run, items, phase, onFinish]);

  const onSubmit = async () => {
    if (!runId || !run || orderedItems.length === 0) return;
    const item = orderedItems[currentIndex];
    if (!item) return;
    const text = currentAnswer.trim();
    if (text.length === 0) {
      setErrorMsg("Please enter an answer before submitting.");
      return;
    }

    if (isExamMode) {
      examAnswersRef.current.set(item.itemId, text);
      if (currentIndex + 1 < total) {
        setCurrentAnswer("");
        setCurrentIndex((i) => i + 1);
        setErrorMsg(null);
      } else {
        setPhase("grading");
        setErrorMsg(null);
        setExamBulkPhase({ graded: 0, total });
        await gradeExamAnswers();
      }
      return;
    }

    setPhase("grading");
    setErrorMsg(null);
    try {
      const gradeEndpoint = arenaTypeSet.has(item.type)
        ? "/api/practice/arena/grade"
        : "/api/topics/practice/grade";
      const res = await fetch(gradeEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, itemId: item.itemId, userAnswer: text }),
      });
      const data = (await res.json()) as GradeResponse;
      if (!res.ok) {
        setErrorMsg(`Grader failed (${res.status}). Try again.`);
        setPhase("answering");
        return;
      }
      setGrade(data);
      setPhase("graded");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setPhase("answering");
    }
  };

  const handleNext = useCallback(() => {
    setCurrentAnswer("");
    setErrorMsg(null);
    if (currentIndex + 1 < total) {
      setCurrentIndex((i) => i + 1);
      setPhase("answering");
      setGrade(null);
    } else {
      void onFinishRun();
    }
  }, [currentIndex, total, onFinishRun]);

  const onNext = () => {
    handleNext();
  };

  const gradeExamAnswers = async () => {
    if (!runId || !run) return;
    const answers = examAnswersRef.current;
    const ungradedItems = orderedItems.filter((it) => answers.has(it.itemId));
    const grades = examGradesRef.current;
    let graded = 0;
    for (const item of ungradedItems) {
      const answer = answers.get(item.itemId);
      if (!answer) continue;
      try {
        const gradeEndpoint = arenaTypeSet.has(item.type)
          ? "/api/practice/arena/grade"
          : "/api/topics/practice/grade";
        const res = await fetch(gradeEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId,
            itemId: item.itemId,
            userAnswer: answer,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as GradeResponse;
          grades.set(item.itemId, data);
        }
      } catch {
        // Single grading failure does not block finishing the run.
      }
      graded++;
      setExamBulkPhase({ graded, total: ungradedItems.length });
    }
    void onFinishRun(grades);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (phase === "loading") {
    return (
      <div className="rounded-xl border border-border bg-background p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)]">
        <div className="h-4 w-40 animate-pulse rounded bg-muted/30" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="rounded-xl border border-border bg-background p-7 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)]">
        <p className="text-[12.5px] text-muted-foreground">
          {errorMsg ?? "An error occurred."}
        </p>
      </div>
    );
  }

  const currentItem = orderedItems[currentIndex];
  if (!currentItem) {
    return (
      <div className="rounded-xl border border-border bg-background p-7 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)]">
        <p className="text-[13px] text-foreground">No more questions.</p>
        <button
          type="button"
          onClick={() => onFinishRun()}
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
        >
          View summary
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {isTimedMode && timeRemaining !== null && (
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 self-start">
          <Timer className="h-3.5 w-3.5 text-muted-foreground" weight="duotone" />
          <span
            className={cn(
              "font-mono text-[13px] tabular-nums",
              timeRemaining < 60
                ? "text-subject-french"
                : "text-foreground"
            )}
          >
            {formatTime(timeRemaining)}
          </span>
        </div>
      )}

      {isExamMode && (
        <div className="rounded-full border border-border bg-surface-elevated px-3 py-1.5 self-start">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground">
            Exam mode — no feedback until the end
          </span>
        </div>
      )}

      {errorMsg && (
        <p className="rounded-lg border border-subject-french/30 bg-subject-french/10 px-3 py-2 text-[12px] text-subject-french">
          {errorMsg}
        </p>
      )}

      <div className="flex items-center gap-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{
              width: `${total > 0 ? ((currentIndex + 1) / total) * 100 : 0}%`,
            }}
          />
        </div>
        <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground shrink-0">
          {currentIndex + 1}/{total}
        </span>
      </div>

      <CockpitCard>
        <CockpitCardHeader
          label={`Question ${currentIndex + 1} of ${total}`}
          trailing={
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              {currentItem.skill}
            </span>
          }
        />
        <AIMarkdown
          id={`arena-${runId}-q${currentIndex}`}
          content={currentItem.prompt}
          density="bare"
        />

        <div className="mt-4 flex flex-col gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            {currentItem.type === "mcq" ? "Choose one" : "Your answer"}
          </span>
          <ItemInput
            item={{
              type: currentItem.type,
              options: currentItem.options,
              wordCountTarget: currentItem.wordCountTarget,
              sourcePhrase: currentItem.sourcePhrase,
              startingExpression: currentItem.startingExpression,
            }}
            value={currentAnswer}
            setValue={setCurrentAnswer}
            disabled={phase !== "answering"}
            subjectSlug={subjectSlug}
          />
          {currentItem.type !== "mcq" &&
            currentItem.type !== "essay_analysis" && (
            <span className="text-[11.5px] text-muted-foreground">
              {currentAnswer.trim().length} characters
            </span>
          )}
        </div>
      </CockpitCard>

      {phase === "grading" && examBulkPhase && (
        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" />
          Grading your exam... {examBulkPhase.graded} of {examBulkPhase.total}
        </div>
      )}

      {phase === "grading" && !examBulkPhase && (
        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" />
          The tutor is reading your answer...
        </div>
      )}

      {grade && phase === "graded" && !isExamMode && (
        <GradeCard
          grade={grade}
          item={currentItem}
          idBase={`arena-${runId}-q${currentIndex}`}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {!isExamMode && (
          <button
            type="button"
            onClick={() => onFinishRun()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface"
          >
            <X className="h-3.5 w-3.5" weight="bold" />
            Finish
          </button>
        )}

        {phase === "answering" && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={currentAnswer.trim().length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkle className="h-3.5 w-3.5" weight="duotone" />
            {isExamMode ? "Next" : "Submit answer"}
          </button>
        )}

        {phase === "graded" && !isExamMode && (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            {currentIndex + 1 < total ? (
              <>
                Next question
                <ArrowRight className="h-3.5 w-3.5" weight="bold" />
              </>
            ) : (
              <>
                Finish & view summary
                <CheckCircle className="h-3.5 w-3.5" weight="bold" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

interface ItemInputProps {
  readonly type: PracticeItemType;
  readonly options: readonly string[] | null;
  readonly wordCountTarget: number | null;
  readonly sourcePhrase: string | null;
  readonly startingExpression: string | null;
}

function ItemInput({
  item,
  value,
  setValue,
  disabled,
  subjectSlug,
}: {
  readonly item: ItemInputProps;
  readonly value: string;
  readonly setValue: (next: string) => void;
  readonly disabled: boolean;
  readonly subjectSlug?: string;
}) {
  if (item.type === "mcq") {
    const options = item.options ?? [];
    return (
      <div className="flex flex-col gap-2">
        {options.length === 0 ? (
          <p className="text-[12px] text-subject-french">
            This MCQ has no options recorded.
          </p>
        ) : (
          options.map((opt, i) => {
            const selected = value === opt;
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => setValue(opt)}
                className={cn(
                  "flex h-auto min-h-[3rem] items-start gap-3 rounded-lg border border-border bg-background px-3.5 py-2.5 text-left text-[13px] leading-relaxed text-foreground transition-colors hover:border-foreground/40 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60",
                  selected &&
                    "border-accent bg-accent-subtle/40 text-foreground"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    selected
                      ? "bg-accent text-accent-foreground"
                      : "border border-border"
                  )}
                >
                  {selected ? (
                    <Check className="h-3 w-3" weight="bold" />
                  ) : (
                    <span className="font-mono text-[10px] tabular-nums">
                      {String.fromCharCode(65 + i)}
                    </span>
                  )}
                </span>
                <span>{opt}</span>
              </button>
            );
          })
        )}
      </div>
    );
  }

  if (item.type === "essay_analysis") {
    return <EssayAnalysisInput value={value} setValue={setValue} disabled={disabled} wordCountTarget={item.wordCountTarget} />;
  }

  if (item.type === "translation_drill") {
    return <TranslationDrillInput value={value} setValue={setValue} disabled={disabled} sourcePhrase={item.sourcePhrase} />;
  }

  if (item.type === "formula_derivation") {
    return (
      <MathInput
        value={value}
        setValue={setValue}
        disabled={disabled}
        startingExpression={item.startingExpression}
        placeholder="Derive the target step by step. Use \\( ... \\) for inline math and \\[ ... \\] for display math."
      />
    );
  }

  if (item.type === "oral_recall") {
    return <OralRecallInput value={value} setValue={setValue} disabled={disabled} />;
  }

  if (item.type === "fill_blank") {
    return (
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        rows={2}
        maxLength={500}
        placeholder="Fill in the blank — write the missing word or phrase."
        className="min-h-[3rem] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40 disabled:opacity-60"
      />
    );
  }

  if (item.type === "step_problem") {
    const category = getSubjectCategory(subjectSlug ?? "");
    if (category === "math" || category === "physics") {
      return (
        <MathInput
          value={value}
          setValue={setValue}
          disabled={disabled}
          placeholder="Work through the problem step by step. Use \\( ... \\) for inline math."
        />
      );
    }
    return (
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        rows={8}
        maxLength={3000}
        placeholder="Work through the problem step by step. Number each step clearly."
        className="min-h-[6rem] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-[13px] font-mono leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40 disabled:opacity-60"
      />
    );
  }

  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      disabled={disabled}
      rows={6}
      maxLength={2000}
      placeholder="Write a clear answer."
      className="min-h-[6rem] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40 disabled:opacity-60"
    />
  );
}

function EssayAnalysisInput({
  value,
  setValue,
  disabled,
  wordCountTarget,
}: {
  readonly value: string;
  readonly setValue: (next: string) => void;
  readonly disabled: boolean;
  readonly wordCountTarget: number | null;
}) {
  const charCount = value.trim().length;
  const wordCount = value.trim().length > 0 ? value.trim().split(/\s+/).length : 0;

  return (
    <>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        rows={10}
        maxLength={3000}
        placeholder="Write 80–300 words analysing the prompt above."
        className="min-h-[8rem] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40 disabled:opacity-60"
      />
      <div className="flex items-center gap-3">
        <span className="text-[11.5px] text-muted-foreground">
          {wordCount} word{wordCount !== 1 ? "s" : ""} ({charCount} characters)
        </span>
        {wordCountTarget !== null && (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
            Target: {wordCountTarget} words
          </span>
        )}
      </div>
    </>
  );
}

function TranslationDrillInput({
  value,
  setValue,
  disabled,
  sourcePhrase,
}: {
  readonly value: string;
  readonly setValue: (next: string) => void;
  readonly disabled: boolean;
  readonly sourcePhrase: string | null;
}) {
  return (
    <>
      {sourcePhrase && (
        <div className="rounded-lg border border-accent-border/40 bg-accent-subtle/20 px-3.5 py-2.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            Source phrase
          </span>
          <p className="mt-1 text-[13.5px] font-medium leading-relaxed text-foreground">
            {sourcePhrase}
          </p>
        </div>
      )}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        rows={5}
        maxLength={2000}
        placeholder="Translate the phrase above into German."
        className="min-h-[5rem] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40 disabled:opacity-60"
      />
    </>
  );
}

function OralRecallInput({
  value,
  setValue,
  disabled,
}: {
  readonly value: string;
  readonly setValue: (next: string) => void;
  readonly disabled: boolean;
}) {
  const selfCheckPrefix = "[self-check:";
  const hasSelfCheck = value.includes(selfCheckPrefix);

  const toggleSelfCheck = (result: "correct" | "struggled") => {
    const cleanValue = hasSelfCheck
      ? value.replace(/\[self-check:\s*(correct|struggled)\]/g, "").trim()
      : value;
    setValue(`${cleanValue}\n\n[self-check: ${result}]`.trim());
  };

  const currentCheck = hasSelfCheck
    ? value.includes("[self-check: correct]") ? "correct" : "struggled"
    : null;

  return (
    <>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        rows={6}
        maxLength={2000}
        placeholder="Recite your answer aloud, then type a summary here."
        className="min-h-[5rem] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40 disabled:opacity-60"
      />
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">
          Self-check:
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => toggleSelfCheck("correct")}
          className={cn(
            "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
            currentCheck === "correct"
              ? "border-accent bg-accent-subtle/40 text-accent"
              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          )}
        >
          I recalled this correctly
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => toggleSelfCheck("struggled")}
          className={cn(
            "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
            currentCheck === "struggled"
              ? "border-subject-french/40 bg-subject-french/10 text-subject-french"
              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          )}
        >
          I struggled with this
        </button>
      </div>
    </>
  );
}

function GradeCard({
  grade,
  item,
  idBase,
}: {
  readonly grade: GradeResponse;
  readonly item: {
    readonly prompt: string;
    readonly rubric: readonly string[];
  };
  readonly idBase: string;
}) {
  const verdictColor =
    grade.verdict === "correct"
      ? "var(--subject-chemistry)"
      : grade.verdict === "partially_correct"
        ? "var(--subject-german)"
        : "var(--subject-french)";
  const verdictLabel =
    grade.verdict === "correct"
      ? "correct"
      : grade.verdict === "partially_correct"
        ? "partially correct"
        : "incorrect";
  const scorePct = Math.round(grade.score * 100);

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Grader"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            score {scorePct}%
          </span>
        }
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{
              backgroundColor: `color-mix(in srgb, ${verdictColor} 12%, transparent)`,
              borderColor: `color-mix(in srgb, ${verdictColor} 36%, transparent)`,
              color: verdictColor,
            }}
          >
            {verdictLabel}
          </span>
          {grade.degraded && (
            <span className="inline-flex items-center gap-1 rounded-full border border-subject-french/40 bg-subject-french/10 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-subject-french">
              <WarningCircle className="h-3 w-3" weight="bold" />
              fallback
            </span>
          )}
        </div>

        <AIMarkdown
          id={`${idBase}-feedback`}
          content={grade.feedback}
          density="compact"
        />

        <div className="rounded-lg border border-accent-border/40 bg-accent-subtle/30 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
            Stronger answer
          </p>
          <div className="mt-1">
            <AIMarkdown
              id={`${idBase}-better`}
              content={grade.betterAnswer}
              density="compact"
            />
          </div>
        </div>

        {item.rubric.length > 0 && (
          <details className="rounded-lg border border-border bg-surface-elevated/40 px-3 py-2">
            <summary className="cursor-pointer text-[11.5px] font-medium text-muted-foreground">
              Show rubric
            </summary>
            <ul className="mt-2 list-disc pl-4 text-[12px] text-foreground/90">
              {item.rubric.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </CockpitCard>
  );
}

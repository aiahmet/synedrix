"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  X,
  Timer,
  Pause,
  Play,
  Stop,
  ArrowRight,
  Notebook,
  Target,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";

export function FocusMode({
  open,
  onClose,
  subjectTitle,
  topicTitle,
  goalLabel,
  onSessionEnd,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly subjectTitle?: string;
  readonly topicTitle?: string;
  readonly goalLabel?: string;
  readonly onSessionEnd?: (durationSec: number, reflection: string) => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reflection, setReflection] = useState("");
  const [phase, setPhase] = useState<"running" | "reflecting" | "done">("running");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setElapsed(0);
      setReflection("");
      setPhase("running");
      setIsPaused(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    if (phase === "running" && !isPaused) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, phase, isPaused]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (phase === "running") {
          setIsPaused(true);
          setPhase("reflecting");
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, phase, onClose]);

  const handleEndSession = () => {
    setPhase("reflecting");
    setIsPaused(true);
  };

  const handleSubmitReflection = () => {
    onSessionEnd?.(elapsed, reflection.trim());
    setPhase("done");
    setTimeout(() => onClose(), 1500);
  };

  const handleSkipReflection = () => {
    onSessionEnd?.(elapsed, "");
    setPhase("done");
    setTimeout(() => onClose(), 1500);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md"
        >
          {phase === "running" && (
            <FocusRunning
              elapsed={elapsed}
              isPaused={isPaused}
              onTogglePause={() => setIsPaused((p) => !p)}
              onEnd={handleEndSession}
              onClose={onClose}
              subjectTitle={subjectTitle}
              topicTitle={topicTitle}
              goalLabel={goalLabel}
              reduce={reduce}
            />
          )}

          {phase === "reflecting" && (
            <FocusReflection
              elapsed={elapsed}
              reflection={reflection}
              setReflection={setReflection}
              onSubmit={handleSubmitReflection}
              onSkip={handleSkipReflection}
              reduce={reduce}
            />
          )}

          {phase === "done" && (
            <FocusDone elapsed={elapsed} reduce={reduce} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FocusRunning({
  elapsed,
  isPaused,
  onTogglePause,
  onEnd,
  onClose,
  subjectTitle,
  topicTitle,
  goalLabel,
  reduce,
}: {
  readonly elapsed: number;
  readonly isPaused: boolean;
  readonly onTogglePause: () => void;
  readonly onEnd: () => void;
  readonly onClose: () => void;
  readonly subjectTitle?: string;
  readonly topicTitle?: string;
  readonly goalLabel?: string;
  readonly reduce: boolean;
}) {
  const formatTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={reduce ? false : { scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={reduce ? { opacity: 0 } : { scale: 0.96, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex w-full max-w-sm flex-col items-center gap-8"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
      >
        <X className="h-4 w-4" weight="bold" />
      </button>

      {(subjectTitle || topicTitle || goalLabel) && (
        <div className="flex flex-col items-center gap-1.5 text-center">
          {goalLabel && (
            <span className="rounded-full border border-border bg-surface-elevated px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {goalLabel}
            </span>
          )}
          {subjectTitle && (
            <span className="text-[16px] font-semibold tracking-tight text-foreground">
              {subjectTitle}
            </span>
          )}
          {topicTitle && (
            <span className="text-[13px] text-muted-foreground">
              {topicTitle}
            </span>
          )}
        </div>
      )}

      <div className={cn(
        "flex items-center gap-3 font-mono tabular-nums",
        isPaused ? "text-muted-foreground" : "text-foreground"
      )}>
        <Timer className={cn("h-5 w-5", isPaused ? "text-muted-foreground" : "text-accent")} weight="duotone" />
        <span className="text-[64px] font-light leading-none tracking-[-0.03em]">
          {formatTime(elapsed)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePause}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-elevated text-foreground transition-colors hover:bg-surface"
        >
          {isPaused ? <Play className="h-5 w-5" weight="fill" /> : <Pause className="h-5 w-5" weight="fill" />}
        </button>
        <button
          type="button"
          onClick={onEnd}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_4px_18px_-6px_color-mix(in_srgb,var(--accent)_45%,transparent)] transition-colors hover:bg-accent/90"
        >
          <Stop className="h-5 w-5" weight="fill" />
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {isPaused ? "Paused — Press play to resume" : "Close notifications, stay focused. Esc to end."}
      </p>
    </motion.div>
  );
}

function FocusReflection({
  elapsed,
  reflection,
  setReflection,
  onSubmit,
  onSkip,
  reduce,
}: {
  readonly elapsed: number;
  readonly reflection: string;
  readonly setReflection: (s: string) => void;
  readonly onSubmit: () => void;
  readonly onSkip: () => void;
  readonly reduce: boolean;
}) {
  const formatTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={reduce ? false : { scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex w-full max-w-sm flex-col items-center gap-5"
    >
      <span className="font-mono text-[20px] tabular-nums text-muted-foreground">{formatTime(elapsed)}</span>
      <div className="flex flex-col items-center gap-1">
        <Notebook className="h-5 w-5 text-accent" weight="duotone" />
        <span className="text-[14px] font-medium text-foreground">What did you learn?</span>
        <p className="text-[11px] text-muted-foreground">A quick reflection helps cement the session.</p>
      </div>
      <textarea
        value={reflection}
        onChange={(e) => setReflection(e.target.value)}
        placeholder="Write a short reflection... (optional)"
        rows={3}
        className="w-full resize-none rounded-xl border border-border bg-surface-elevated px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40"
      />
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-surface"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-4 text-[12px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
        >
          Save &amp; close
          <ArrowRight className="h-3 w-3" weight="bold" />
        </button>
      </div>
    </motion.div>
  );
}

function FocusDone({ elapsed, reduce }: { readonly elapsed: number; readonly reduce: boolean }) {
  const formatTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={reduce ? false : { scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-4"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15">
        <Target className="h-6 w-6 text-accent" weight="fill" />
      </div>
      <span className="font-mono text-[28px] tabular-nums text-foreground">{formatTime(elapsed)}</span>
      <p className="text-[13px] font-medium text-foreground">Session complete</p>
    </motion.div>
  );
}

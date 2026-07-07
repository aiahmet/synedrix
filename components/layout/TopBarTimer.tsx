"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Timer, Play, Pause, X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";

export function TopBarTimer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setElapsed(0);
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const formatTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[11.5px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
        aria-label="Open quick timer"
      >
        <Timer className="h-3.5 w-3.5" weight="bold" />
        <span className="hidden lg:inline">Timer</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-accent-border/30 bg-accent-subtle/10 px-2 py-1">
      <span
        className={cn(
          "font-mono text-[13px] tabular-nums",
          isRunning ? "text-accent" : "text-muted-foreground"
        )}
      >
        {formatTime(elapsed)}
      </span>
      <button
        type="button"
        onClick={isRunning ? pauseTimer : startTimer}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
        aria-label={isRunning ? "Pause timer" : "Start timer"}
      >
        {isRunning ? (
          <Pause className="h-3 w-3" weight="fill" />
        ) : (
          <Play className="h-3 w-3" weight="fill" />
        )}
      </button>
      <button
        type="button"
        onClick={resetTimer}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
        aria-label="Close timer"
      >
        <X className="h-3 w-3" weight="bold" />
      </button>
    </div>
  );
}

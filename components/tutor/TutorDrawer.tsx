"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type TutorSide = "left" | "right";

const MIN_WIDTH = 280;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 360;

export function TutorDrawer({
  side,
  open,
  onOpenChange,
  label,
  children,
  widthClassName,
}: {
  readonly side: TutorSide;
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  readonly label: string;
  readonly children: React.ReactNode;
  readonly widthClassName?: string;
}) {
  const reduce = useReducedMotion();
  const isLeft = side === "left";
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_WIDTH);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
    },
    [width]
  );

  useEffect(() => {
    if (!isResizing) return;
    const onMouseMove = (e: MouseEvent) => {
      const delta = isLeft
        ? e.clientX - startXRef.current
        : startXRef.current - e.clientX;
      const next = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, startWidthRef.current + delta)
      );
      setWidth(next);
    };
    const onMouseUp = () => setIsResizing(false);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizing, isLeft]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const resolvedWidth = widthClassName
    ? widthClassName
    : `w-[min(${width}px,calc(100vw-2.5rem))]`;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label={`Close ${label}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px]"
          />
          <motion.aside
            role="dialog"
            aria-label={label}
            initial={reduce ? false : { x: isLeft ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: isLeft ? "-100%" : "100%" }}
            transition={{
              duration: 0.28,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={
              widthClassName
                ? undefined
                : { width: `${width}px`, maxWidth: "calc(100vw - 2.5rem)" }
            }
            className={
              widthClassName
                ? `fixed inset-y-0 z-50 ${isLeft ? "left-0 border-r" : "right-0 border-l"} flex flex-col border-border bg-background shadow-[var(--shadow-pop)] ${resolvedWidth}`
                : `fixed inset-y-0 z-50 ${isLeft ? "left-0 border-r" : "right-0 border-l"} flex flex-col border-border bg-background shadow-[var(--shadow-pop)]`
            }
          >
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
              <span className="text-[12.5px] font-medium tracking-[-0.005em] text-foreground">
                {label}
              </span>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label={`Close ${label}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" weight="bold" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize drawer"
              tabIndex={0}
              onMouseDown={onMouseDown}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  const delta = e.key === (isLeft ? "ArrowRight" : "ArrowLeft") ? 40 : -40;
                  setWidth((prev) =>
                    Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, prev + delta))
                  );
                }
              }}
              className={`absolute ${isLeft ? "-right-1" : "-left-1"} inset-y-0 z-10 w-2 cursor-col-resize transition-colors hover:bg-accent/10 active:bg-accent/20 ${isResizing ? "bg-accent/15" : ""}`}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

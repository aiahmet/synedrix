"use client";

import { useEffect } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type TutorSide = "left" | "right";

export function TutorDrawer({
  side,
  open,
  onOpenChange,
  label,
  children,
  widthClassName = "w-[min(360px,calc(100vw-2.5rem))]",
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
            className={`fixed inset-y-0 z-50 ${isLeft ? "left-0 border-r" : "right-0 border-l"} flex flex-col border-border bg-background shadow-[var(--shadow-pop)] ${widthClassName}`}
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
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

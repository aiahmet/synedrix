"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useQuery } from "convex/react";
import { cn } from "@/lib/utils/cn";
import { api } from "@/convex/_generated/api";

interface SearchResult {
  kind: "page" | "subject" | "topic";
  label: string;
  subtitle: string;
  href: string;
}

const BUILTIN_COMMANDS: SearchResult[] = [
  { kind: "page", label: "Dashboard", subtitle: "Home cockpit", href: "/dashboard" },
  { kind: "page", label: "Subjects", subtitle: "Browse curriculum", href: "/subjects" },
  { kind: "page", label: "Planner", subtitle: "Plan your sessions", href: "/planner" },
  { kind: "page", label: "Review", subtitle: "Spaced repetition", href: "/review" },
  { kind: "page", label: "Tutor", subtitle: "AI tutor workspace", href: "/tutor" },
  { kind: "page", label: "Practice Arena", subtitle: "Practice exercises", href: "/practice" },
  { kind: "page", label: "Settings", subtitle: "Account and data", href: "/settings" },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion() ?? false;

  const subjects = useQuery(api.subjects.list, open ? {} : "skip");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  const dynamicResults = useMemo<SearchResult[]>(() => {
    if (!subjects) return [];
    const results: SearchResult[] = [];
    for (const s of subjects) {
      results.push({
        kind: "subject",
        label: s.title,
        subtitle: `${s.chapterCount} chapters · ${s.topicCount} topics`,
        href: `/subjects/${s.slug}`,
      });
    }
    return results;
  }, [subjects]);

  const allResults = useMemo(() => {
    const combined = [...BUILTIN_COMMANDS, ...dynamicResults];
    if (!query.trim()) return combined.slice(0, 12);
    const q = query.toLowerCase();
    return combined
      .filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.subtitle.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, dynamicResults]);

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const handleSelectIndex = useCallback(
    (index: number) => {
      const result = allResults[index];
      if (result) {
        handleSelect(result.href);
      }
    },
    [allResults, handleSelect]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < allResults.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : allResults.length - 1
        );
        return;
      }
      if (e.key === "Enter" && allResults.length > 0) {
        handleSelectIndex(selectedIndex);
      }
    },
    [allResults, selectedIndex, handleSelectIndex]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-8 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-[11.5px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground md:flex"
        aria-label="Search or run command (Cmd+K)"
      >
        <MagnifyingGlass className="h-3.5 w-3.5 shrink-0" weight="bold" />
        <span className="hidden lg:inline">Search...</span>
        <kbd className="ml-auto hidden rounded border border-border bg-surface-elevated px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground lg:inline">
          ⌘K
        </kbd>
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground md:hidden"
        aria-label="Search"
      >
        <MagnifyingGlass className="h-4 w-4" weight="bold" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-[1px]"
            />
            <motion.div
              initial={reduce ? false : { scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="fixed left-1/2 top-[20%] z-50 w-full max-w-md -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-background shadow-[0_16px_48px_-12px_rgba(0,0,0,0.25)]"
            >
              <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
                <MagnifyingGlass className="h-3.5 w-3.5 shrink-0 text-muted-foreground" weight="bold" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Search pages, subjects, topics..."
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" weight="bold" />
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto py-1.5">
                {allResults.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-[12px] text-muted-foreground">No results found.</p>
                  </div>
                ) : (
                  allResults.map((result, idx) => (
                    <button
                      key={`${result.kind}-${result.href}`}
                      type="button"
                      onClick={() => handleSelect(result.href)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-elevated",
                        idx === selectedIndex && "bg-surface-elevated"
                      )}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-elevated font-mono text-[9.5px] uppercase text-muted-foreground">
                        {result.kind === "page" ? "Pg" : result.kind === "subject" ? "Sub" : "Top"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-foreground">
                          {result.label}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {result.subtitle}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="flex items-center gap-3 border-t border-border px-4 py-2">
                <span className="text-[10px] text-muted-foreground">
                  <kbd className="rounded border border-border bg-surface-elevated px-1 py-0.5 font-mono text-[9px]">↑↓</kbd> Navigate
                </span>
                <span className="text-[10px] text-muted-foreground">
                  <kbd className="rounded border border-border bg-surface-elevated px-1 py-0.5 font-mono text-[9px]">↵</kbd> Open
                </span>
                <span className="text-[10px] text-muted-foreground">
                  <kbd className="rounded border border-border bg-surface-elevated px-1 py-0.5 font-mono text-[9px]">Esc</kbd> Close
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

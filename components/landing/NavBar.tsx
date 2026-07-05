"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { navLinks } from "@/components/landing/data";
import { ArrowRight, List as ListIcon, X } from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";

/**
 * Floating pill navbar.
 *
 * Engineering notes:
 *   - IntersectionObserver drives the "scrolled" state instead of a
 *     scroll listener: zero per-frame work, no mobile jank.
 *   - The body scroll lock runs only while the mobile menu is open,
 *     and the cleanup runs on unmount so we never leave the body
 *     in a locked state.
 *   - Reduced-motion users skip every spring transition.
 *   - Focus moves to the first link when the menu opens and is
 *     sent back to the trigger when it closes, satisfying WAI-ARIA
 *     disclosure semantics.
 *   - The pill lives in a max-w-6xl centered floating container,
 *     so it never stretches edge-to-edge like a generic CMS bar.
 */
export function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduce = useReducedMotion();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const mobileListRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Snapshot the trigger; React may swap the ref by the time the
    // cleanup runs.
    const triggerSnapshot = triggerRef.current;
    const firstLink =
      mobileListRef.current?.querySelector<HTMLAnchorElement>("a");
    firstLink?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      triggerSnapshot?.focus();
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-foreground"
      >
        Skip to content
      </a>

      <div ref={sentinelRef} className="absolute top-0 h-px w-px" aria-hidden />

      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 sm:pt-6">
        <motion.nav
          initial={reduce ? false : { y: -32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          aria-label="Primary"
          className={cn(
            "flex w-full max-w-6xl items-center justify-between rounded-full border px-3 py-2 transition-[background-color,border-color,box-shadow] duration-500 sm:px-5",
            scrolled
              ? "border-border bg-surface-elevated/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_32px_-12px_rgba(0,0,0,0.08)] backdrop-blur-2xl"
              : "border-border-faint bg-surface-elevated/60 backdrop-blur-xl"
          )}
        >
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-full px-1.5 py-1 font-semibold tracking-tight text-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Synedrix home"
          >
            <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg">
              <Image
                src="/synedrix-logo.png"
                alt=""
                fill
                className="object-cover"
                sizes="28px"
              />
            </span>
            <span className="text-sm">Synedrix</span>
            <span className="ml-1 hidden rounded-full border border-border bg-surface px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground lg:inline">
              v1
            </span>
          </Link>

          <ul className="hidden items-center gap-0.5 md:flex">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium text-muted-foreground outline-none transition-colors duration-300 hover:bg-surface hover:text-foreground focus-visible:bg-surface focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/sign-in"
              className="hidden h-8 items-center rounded-full px-3 text-[13px] font-medium text-muted-foreground outline-none transition-colors duration-300 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="group ml-0.5 hidden h-8 items-center gap-1.5 rounded-full bg-accent pl-4 pr-2 text-[13px] font-medium text-accent-foreground outline-none shadow-[0_2px_8px_rgba(13,148,136,0.25)] transition-all duration-300 hover:opacity-95 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex"
            >
              Start learning
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-foreground/15 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:scale-105">
                <ArrowRight className="h-3 w-3" weight="bold" />
              </span>
            </Link>

            <button
              ref={triggerRef}
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-surface hover:text-foreground focus-visible:bg-surface focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                {mobileOpen ? (
                  <motion.span
                    key="close"
                    initial={reduce ? false : { rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={reduce ? { opacity: 1 } : { rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="h-4 w-4" weight="bold" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="open"
                    initial={reduce ? false : { rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={reduce ? { opacity: 1 } : { rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ListIcon className="h-4 w-4" weight="bold" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </motion.nav>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Primary"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-2xl md:hidden"
          >
            <div
              ref={mobileListRef}
              className="flex h-full flex-col items-center justify-center gap-1 px-6"
            >
              <ul className="flex flex-col items-center gap-1">
                {navLinks.map((link, i) => (
                  <motion.li
                    key={link.href}
                    initial={reduce ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
                    transition={{
                      delay: 0.05 + i * 0.04,
                      duration: 0.4,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <Link
                      href={link.href}
                      onClick={closeMobile}
                      className="block rounded-full px-6 py-3 text-xl font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:bg-surface focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {link.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
                transition={{ delay: 0.05 + navLinks.length * 0.04, duration: 0.4 }}
                className="mt-8 flex flex-col items-center gap-3"
              >
                <Link
                  href="/sign-in"
                  onClick={closeMobile}
                  className="rounded-full border border-border px-7 py-2.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  onClick={closeMobile}
                  className="rounded-full bg-accent px-7 py-2.5 text-sm font-medium text-accent-foreground shadow-[0_2px_8px_rgba(13,148,136,0.25)] outline-none transition-all hover:opacity-95 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Start learning
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

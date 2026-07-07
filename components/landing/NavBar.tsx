"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { navLinks } from "@/components/landing/data";
import { ArrowRight, List as ListIcon, X } from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";

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
      <div ref={sentinelRef} className="absolute top-0 h-px w-px" aria-hidden />

      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 sm:pt-6">
        <motion.nav
          initial={reduce ? false : { y: -32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          aria-label="Primary"
          className={cn(
            "flex w-full max-w-4xl items-center justify-between rounded-full border px-3 py-2 transition-[background-color,border-color,box-shadow] duration-500 sm:px-5",
            scrolled
              ? "border-border bg-background shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] dark:border-border/60"
              : "border-transparent bg-transparent"
          )}
        >
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md px-1.5 py-1 font-semibold tracking-tight text-foreground outline-none transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
            aria-label="Synedrix home"
          >
            <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-md">
              <Image
                src="/synedrix-logo.png"
                alt=""
                fill
                className="object-cover"
                sizes="28px"
              />
            </span>
            <span className="text-sm">Synedrix</span>
          </Link>

          <ul className="hidden items-center gap-0.5 md:flex">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium text-muted-foreground outline-none transition-colors duration-300 hover:bg-muted-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:bg-muted-foreground/5 focus-visible:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/40"
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
              className="hidden h-8 items-center rounded-md px-3 text-[13px] font-medium text-muted-foreground outline-none transition-colors duration-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 sm:inline-flex"
            >
              Anmelden
            </Link>
            <Link
              href="/sign-up"
              className="group ml-0.5 hidden h-8 items-center gap-1.5 rounded-md bg-accent pl-4 pr-3 text-[13px] font-medium text-accent-foreground outline-none shadow-none transition-colors duration-300 hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 sm:inline-flex"
            >
              Loslegen
              <ArrowRight
                className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5"
                weight="bold"
              />
            </Link>

            <button
              ref={triggerRef}
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:bg-muted-foreground/5 focus-visible:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/40 md:hidden"
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
            className="fixed inset-0 z-40 bg-background md:hidden"
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
                      className="block rounded-md px-6 py-3 text-xl font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:outline-none focus-visible:bg-muted-foreground/5 focus-visible:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/40"
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
                  className="rounded-md border border-border px-7 py-2.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted-foreground/5 focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground/40"
                >
                  Anmelden
                </Link>
                <Link
                  href="/sign-up"
                  onClick={closeMobile}
                  className="group inline-flex items-center gap-1.5 rounded-md bg-accent px-7 py-2.5 text-sm font-medium text-accent-foreground shadow-none outline-none transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
                >
                  Loslegen
                  <ArrowRight
                    className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5"
                    weight="bold"
                  />
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

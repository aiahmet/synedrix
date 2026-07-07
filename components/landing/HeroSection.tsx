"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { ArrowRight, ChatCircleText, Target, Timer, ClockCounterClockwise } from "@/components/landing/icons";
import type { PhosphorIconComponent } from "@/components/landing/icons";

function SingleLayerCard({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return (
    <div
      className={`rounded-xl border border-border bg-background p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] dark:border-border/60 dark:bg-background dark:shadow-[0_1px_0_0_rgb(255_255_255_/_0.05),0_8px_24px_-12px_rgba(0,0,0,0.45)] ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function PanelHeader({
  icon: Icon,
  label,
  badge,
}: {
  readonly icon: PhosphorIconComponent;
  readonly label: string;
  readonly badge?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/80" weight="duotone" />
        <span className="text-[11px] font-medium text-foreground">{label}</span>
      </div>
      {badge && (
        <span className="font-mono text-[10px] text-accent">
          {badge}
        </span>
      )}
    </div>
  );
}

function TutorPanel() {
  return (
    <SingleLayerCard className="w-56">
      <PanelHeader icon={ChatCircleText} label="KI-Tutor" badge="Mathe" />
      <div className="space-y-2">
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded bg-muted-foreground/5 px-2.5 py-1 text-[11px] leading-relaxed text-foreground/80">
            Zeig mir die Kettenregel Schritt für Schritt
          </div>
        </div>

        <div className="flex justify-start">
          <div className="max-w-[90%] border-l border-accent/40 pl-2.5 py-0.5">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-accent">d/dx</span>{" "}
              f(g(x)) = f&prime;(g(x)) &middot; g&prime;(x)
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground/75">
              Ableitung der äußeren Funktion an der inneren Stelle, multipliziert mit der inneren Ableitung.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 pl-0.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/35" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/35 [animation-delay:0.15s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/35 [animation-delay:0.3s]" />
        </div>
      </div>
    </SingleLayerCard>
  );
}

function MissionPanel() {
  return (
    <SingleLayerCard className="w-52">
      <PanelHeader icon={Target} label="Heutige Mission" />
      <div className="space-y-1.5">
        {[
          { text: "Kettenregel wiederholen", done: false },
          { text: "Kinematik-Aufgaben", done: false },
          { text: "Subjonctif-Drill", done: true },
        ].map((item) => (
          <div key={item.text} className="flex items-center gap-2">
            <div
              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                item.done
                  ? "border-accent bg-accent"
                  : "border-border"
              }`}
            >
              {item.done && (
                <div className="h-1.5 w-1.5 rounded-full bg-background" />
              )}
            </div>
            <span
              className={`text-[11px] ${
                item.done
                  ? "text-muted-foreground line-through"
                  : "text-foreground"
              }`}
            >
              {item.text}
            </span>
          </div>
        ))}
        <p className="pt-1 text-[10px] font-medium text-accent">
          3 Aufgaben &middot; ~42 Min
        </p>
      </div>
    </SingleLayerCard>
  );
}

function MasteryPanel() {
  return (
    <SingleLayerCard className="w-52">
      <PanelHeader icon={ClockCounterClockwise} label="Lernstand" />
      <div className="space-y-2.5">
        {[
          { subject: "Mathe", pct: 78 },
          { subject: "Physik", pct: 62 },
          { subject: "Französisch", pct: 45 },
        ].map((item) => (
          <div key={item.subject}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-foreground">
                {item.subject}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {item.pct}%
              </span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-muted/20">
              <div
                className="h-1 rounded-full bg-accent transition-all duration-700"
                style={{ width: `${item.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </SingleLayerCard>
  );
}

function ReviewsPanel() {
  return (
    <SingleLayerCard className="w-52">
      <PanelHeader icon={Timer} label="Wiederholungen" badge="2 fällig" />
      <div className="space-y-1.5">
        {[
          { text: "Definitionsbereich: log₂(x)", status: "due" as const },
          { text: "Subjonctif präsent", status: "due" as const },
          { text: "Newtons 2. Gesetz", status: "done" as const },
        ].map((item) => (
          <div key={item.text} className="flex items-center gap-2">
            <div
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                item.status === "due"
                  ? "bg-accent"
                  : "bg-muted"
              }`}
            />
            <span
              className={`truncate text-[11px] ${
                item.status === "done"
                  ? "text-muted-foreground line-through"
                  : "text-foreground"
              }`}
            >
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </SingleLayerCard>
  );
}

function MobilePanelGrid() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 lg:hidden">
      <TutorPanel />
      <MissionPanel />
      <MasteryPanel />
      <ReviewsPanel />
    </div>
  );
}

export function HeroSection() {
  const reduce = useReducedMotion();

  return (
    <section
      aria-labelledby="hero-title"
      className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background px-6 pt-24 sm:px-10 lg:pt-28"
    >
      {/* Main content stack */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col">
        {/* Editorial block */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center"
        >
          {/* Eyebrow */}
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Für das deutsche Gymnasium &middot; Einzelbenutzer-System
          </span>

          {/* Primary headline */}
          <h1
            id="hero-title"
            className="mt-6 max-w-4xl text-balance text-[clamp(2.25rem,5vw+0.5rem,4.25rem)] font-bold leading-[1.02] tracking-[-0.04em] text-foreground"
          >
            Das Betriebssystem
            <br />
            <span className="text-accent">für das Lernen.</span>
          </h1>

          {/* Subtext */}
          <p className="mt-6 max-w-2xl text-pretty text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
            Lerne intelligenter mit einem KI-Tutor, der deinen Lehrplan versteht,
            deinen Fortschritt trackt und jede Lerneinheit von der Unklarheit zur Meisterschaft führt.
          </p>

          {/* CTA row */}
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
            <Link
              href="/sign-up"
              className="group inline-flex h-10 items-center gap-2 rounded-md bg-accent px-5 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Kostenlos starten
              <ArrowRight
                className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5"
                weight="bold"
              />
            </Link>
            <Link
              href="#demo"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/10"
            >
              Demo ansehen
              <ArrowRight className="h-3 w-3" weight="bold" />
            </Link>
          </div>

          {/* Trust row */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {["KI-Tutor", "Adaptives Üben", "Intelligente Wiederholungen", "Lernstands-Tracking"].map(
              (item, i) => (
                <span
                  key={item}
                  className="flex items-center gap-2 text-[12px] text-muted-foreground"
                >
                  {i > 0 && <span className="h-1 w-1 rounded-full bg-border" />}
                  {item}
                </span>
              ),
            )}
          </div>
        </motion.div>

        {/* Flexible spacer */}
        <div className="flex-1 pt-12 md:pt-16" />

        {/* Mockup scene */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto w-full max-w-5xl"
        >
          {/* Desktop glass panels */}
          <div className="hidden lg:block" aria-hidden>
            {/* AI Tutor */}
            <div className="absolute left-0 top-1/2 z-10 -translate-x-[calc(100%-24px)] -translate-y-1/2">
              <TutorPanel />
            </div>

            {/* Today's Mission */}
            <div className="absolute right-0 top-[12%] z-10 translate-x-[calc(100%-24px)]">
              <MissionPanel />
            </div>

            {/* Mastery Progress */}
            <div className="absolute right-0 bottom-[12%] z-10 translate-x-[calc(100%-24px)]">
              <MasteryPanel />
            </div>
          </div>

          {/* Main dashboard mockup */}
          <div className="relative overflow-hidden rounded-2xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] dark:border-border/60 dark:shadow-[0_1px_0_0_rgb(255_255_255_/_0.05),0_8px_24px_-12px_rgba(0,0,0,0.45)]">
            <Image
              src="/synedrix-github-banner.png"
              alt="Synedrix-Dashboard mit Cockpit, Schwachstellen und Wiederholungswarteschlange"
              width={1200}
              height={900}
              className="h-auto w-full object-cover"
              priority
            />
          </div>
        </motion.div>

        {/* Mobile panels */}
        <MobilePanelGrid />

        {/* Bottom breathing room */}
        <div className="h-14 md:h-20" />
      </div>
    </section>
  );
}

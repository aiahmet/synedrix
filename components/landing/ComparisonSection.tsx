"use client";

import { motion, useReducedMotion } from "motion/react";

import { Section, SectionHeading } from "@/components/landing/ui/Section";
import {
  Books,
  Brain,
  ChatCircleText,
  ClockCounterClockwise,
  PencilLine,
  ArrowRight,
} from "@/components/landing/icons";
import type { PhosphorIconComponent } from "@/components/landing/icons";

function WindowDots() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      <span className="h-1.5 w-1.5 rounded-full bg-rose-400/80" />
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
    </div>
  );
}

function BrowserWindow({
  title,
  children,
  className,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-xl border border-border bg-background shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] dark:border-border/60 dark:shadow-[0_1px_0_0_rgb(255_255_255_/_0.05),0_8px_24px_-12px_rgba(0,0,0,0.45)] ${className ?? ""}`}>
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2.5">
        <WindowDots />
        <span className="text-[11px] font-mono font-medium uppercase tracking-[0.05em] text-muted-foreground/60">
          {title}
        </span>
        <div className="w-14" />
      </div>

      {/* Content area */}
      <div className="relative bg-background">{children}</div>
    </div>
  );
}

function SectionLabel({ text }: { readonly text: string }) {
  return (
    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
      {text}
    </span>
  );
}

function TraditionalSide() {
  return (
    <div className="flex flex-col gap-4">
      <SectionLabel text="Herkömmlicher Lern-Stack" />
      <div className="space-y-3">
        {[
          "Separate Notiz-App",
          "Isolierte Karteikarten-Decks",
          "Einzelne Übungs-PDFs",
          "Allgemeine KI-Chatbot-Prompts",
          "Verstreute Excel-Tabellen zur Übersicht",
        ].map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/5 px-4 py-3 text-[13px] text-muted-foreground"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SynedrixRow({
  icon: Icon,
  title,
  description,
}: {
  readonly icon: PhosphorIconComponent;
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="flex items-start gap-3.5 py-3 border-b border-border/40 last:border-0">
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground/80 mt-0.5" weight="duotone" />
      <div>
        <h4 className="text-[13px] font-medium text-foreground">{title}</h4>
        <p className="mt-1 text-[12px] leading-normal text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function SynedrixSide() {
  return (
    <div className="flex flex-col gap-4">
      <SectionLabel text="Study OS" />
      <BrowserWindow title="Synedrix" className="p-4 sm:p-5">
        <div className="flex flex-col">
          <SynedrixRow
            icon={ChatCircleText}
            title="KI-Tutor"
            description="Kontextbewusste Erklärungshilfe"
          />
          <SynedrixRow
            icon={PencilLine}
            title="Adaptives Üben"
            description="Lernstands-Tracking in Echtzeit"
          />
          <SynedrixRow
            icon={ClockCounterClockwise}
            title="Wiederholungswarteschlange"
            description="Spaced-Repetition-Terminierung"
          />
          <SynedrixRow
            icon={Books}
            title="Fehlerjournal"
            description="Fehleranalyse nach Konzepten"
          />
          <SynedrixRow
            icon={Brain}
            title="Analyse-Cockpit"
            description="Detailliertes Lernfeedback"
          />
        </div>
      </BrowserWindow>
    </div>
  );
}

export function ComparisonSection() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section
      id="comparison"
      ariaLabelledBy="comparison-title"
      className="relative overflow-hidden border-t border-border bg-background py-24 sm:py-32"
    >
      {/* Title */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="comparison-title"
          align="center"
          title={
            <>
              Herkömmliche Lernwerkzeuge
              <br />
              vs. Study OS.
            </>
          }
          description={
            <>
              Die Nutzung von fünf verschiedenen Apps führt dazu, dass du mehr Zeit mit der Organisation
              von Notizen verbringst als mit dem eigentlichen Lernen. Synedrix vereint sie in einem einzigen Arbeitsbereich.
            </>
          }
        />
      </motion.div>

      {/* Main split comparison layout */}
      <div className="relative mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-10 md:grid-cols-2 md:gap-14 lg:gap-20">
        <motion.div
          initial={reduce ? false : { opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        >
          <TraditionalSide />
        </motion.div>

        {/* Central divider */}
        <div className="absolute left-1/2 top-0 bottom-0 hidden w-px bg-border/40 md:flex items-center justify-center -translate-x-1/2" aria-hidden>
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background font-mono text-[10px] text-muted-foreground">
            oder
          </div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, x: 16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        >
          <SynedrixSide />
        </motion.div>
      </div>

      {/* Bottom callout: Flow */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto mt-16 max-w-2xl border-t border-border/40 pt-8"
      >
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] font-mono text-muted-foreground">
          {["Lernen", "Fragen", "Üben", "Fehler", "Wiederholen", "Meistern"].map((step, i) => (
            <span key={step} className="flex items-center gap-4">
              {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/30" weight="bold" />}
              <span className={i === 0 ? "text-accent font-medium" : ""}>{step}</span>
            </span>
          ))}
        </div>
      </motion.div>
    </Section>
  );
}

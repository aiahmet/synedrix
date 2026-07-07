"use client";

import { motion, useReducedMotion } from "motion/react";

import { Section, SectionHeading } from "@/components/landing/ui/Section";
import {
  GraduationCap,
  ChatCircleText,
  PencilLine,
  ClipboardText,
  ClockCounterClockwise,
  Gauge,
} from "@/components/landing/icons";
import type { PhosphorIconComponent } from "@/components/landing/icons";

interface LoopCard {
  readonly step: number;
  readonly title: string;
  readonly description: string;
  readonly icon: PhosphorIconComponent;
}

const CARDS: readonly LoopCard[] = [
  {
    step: 1,
    title: "Lernen",
    description: "Verstehe Konzepte mit Erklärungen, die auf dein Niveau zugeschnitten sind.",
    icon: GraduationCap,
  },
  {
    step: 2,
    title: "KI fragen",
    description: "Chatte mit einem KI-Tutor, der genau weiß, woran du gerade arbeitest.",
    icon: ChatCircleText,
  },
  {
    step: 3,
    title: "Üben",
    description: "Generiere unbegrenzt Übungsaufgaben, die sich deinem Fortschritt anpassen.",
    icon: PencilLine,
  },
  {
    step: 4,
    title: "Fehler analysieren",
    description: "Jeder Fehler wird zu direktem Feedback, anstatt einfach vergessen zu werden.",
    icon: ClipboardText,
  },
  {
    step: 5,
    title: "Wiederholen",
    description: "Spaced Repetition bringt Themen genau dann zurück, bevor du sie vergisst.",
    icon: ClockCounterClockwise,
  },
  {
    step: 6,
    title: "Meistern",
    description: "Verfolge deinen Lernstand in jedem Fach mit messbarem Erfolg.",
    icon: Gauge,
  },
] as const;

function CardHeader({
  icon: Icon,
  step,
  title,
}: {
  readonly icon: PhosphorIconComponent;
  readonly step: number;
  readonly title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-muted-foreground transition-colors duration-300 group-hover/card:text-foreground" weight="duotone" aria-hidden />
      <div className="flex flex-1 items-baseline justify-between">
        <h3 className="text-[13.5px] font-medium leading-[1.2] tracking-[-0.005em] text-foreground">
          {title}
        </h3>
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/30">
          {String(step).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

function LearnPreview() {
  return (
    <div className="space-y-3 w-full">
      <div className="flex gap-1 rounded bg-muted-foreground/5 p-0.5">
        {["Einfach", "Standard", "Anspruchsvoll"].map((label, i) => (
          <span
            key={label}
            className={`flex-1 rounded px-2 py-0.5 text-center text-[10px] font-medium transition-colors ${
              i === 1
                ? "bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                : "text-muted-foreground/60"
            }`}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="border-l border-accent/40 pl-3 py-0.5">
        <p className="text-[11.5px] font-medium leading-snug text-foreground">
          Die Kettenregel
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Multipliziere die Ableitung der äußeren Funktion an der inneren Stelle mit der Ableitung der inneren.
        </p>
        <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-accent">
          d/dx f(g(x)) = f&prime;(g(x)) &middot; g&prime;(x)
        </p>
      </div>
    </div>
  );
}

function AskAiPreview() {
  return (
    <div className="space-y-2.5 w-full">
      <div className="flex justify-end">
        <span className="max-w-[85%] rounded bg-muted-foreground/5 px-2.5 py-1 text-[11px] leading-relaxed text-foreground/80">
          Warum multiplizieren wir mit g&prime;(x)?
        </span>
      </div>
      <div className="flex justify-start">
        <div className="max-w-[90%] space-y-1 border-l border-accent/40 pl-3 py-0.5">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Um zu berücksichtigen, wie schnell sich die innere Funktion verändert, während die äußere Funktion hineinzoomt.
          </p>
          <span className="block font-mono text-[10px] text-accent">
            äußere&prime;(innen) &times; innere&prime;
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 pl-1">
        {[0, 150, 300].map((ms) => (
          <span
            key={ms}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/35"
            style={{ animationDelay: `${ms}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function PracticePreview() {
  return (
    <div className="space-y-3 w-full">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/60">
          Aufgabe
        </p>
        <p className="text-[12px] font-medium leading-snug text-foreground mt-0.5">
          Bestimme die Ableitung von sin(x&sup2; + 3x)
        </p>
        <div className="mt-2.5 space-y-1">
          {[
            { text: "cos(x² + 3x) · (2x + 3)", correct: true },
            { text: "cos(x² + 3x)", correct: false },
          ].map((opt, i) => (
            <div
              key={i}
              className="flex items-center gap-2 py-0.5 text-[11px]"
            >
              <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-border">
                {opt.correct && (
                  <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </div>
              <span className={opt.correct ? "font-medium text-foreground" : "text-muted-foreground/80"}>
                {opt.text}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-start gap-2 border-t border-border/40 pt-2 text-[10.5px] text-muted-foreground">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-accent/10 text-[9px] font-medium text-accent">
          Tipp
        </span>
        <span className="leading-normal">Außen: sin(u) &rarr; cos(u). Innen: x&sup2; + 3x &rarr; 2x + 3.</span>
      </div>
    </div>
  );
}

function MistakesPreview() {
  return (
    <div className="space-y-3 w-full">
      <div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.05em] text-red-600 dark:text-red-400">
            Vorzeichenfehler
          </span>
          <span className="text-[10px] text-muted-foreground/30">&middot;</span>
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.05em] text-amber-600 dark:text-amber-400">
            Kettenregel
          </span>
        </div>
        <div className="mt-2 space-y-1 pl-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-red-500 font-bold">&#8212;</span>
            <span className="text-[11px] text-muted-foreground line-through decoration-red-400/30">
              cos(x&sup2;) &middot; 2x
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-emerald-600 font-bold">+</span>
            <span className="text-[11px] font-medium text-foreground">
              2x &middot; cos(x&sup2;)
            </span>
          </div>
        </div>
      </div>
      <p className="border-t border-border/40 pt-2 text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Korrektur:</span> Morgen 3 weitere Kettenregel-Aufgaben üben.
      </p>
    </div>
  );
}

function ReviewPreview() {
  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        {[
          { label: "Sofort", active: true },
          { label: "1T", active: false },
          { label: "3T", active: false },
          { label: "7T", active: false },
          { label: "30T", active: false },
        ].map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-1">
            <span
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                item.active ? "bg-accent" : "bg-muted"
              }`}
            />
            <span className={`text-[9.5px] font-medium ${item.active ? "text-accent" : "text-muted-foreground/60"}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-1 pl-0.5">
        {[
          { text: "Definitionsbereich log₂(x)", due: "heute", active: true },
          { text: "Subjonctif présent", due: "heute", active: true },
          { text: "Newtons 2. Gesetz", due: "in 2T", active: false },
        ].map((item) => (
          <div
            key={item.text}
            className="flex items-center justify-between py-0.5 text-[11px]"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  item.active ? "bg-accent" : "bg-muted"
                }`}
              />
              <span className={item.active ? "text-foreground font-medium" : "text-muted-foreground"}>
                {item.text}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground/50">
              {item.due}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MasterPreview() {
  return (
    <div className="space-y-3 w-full">
      <div className="space-y-2">
        {[
          { subject: "Mathematik", pct: 78, color: "bg-accent" },
          { subject: "Physik", pct: 62, color: "bg-accent/70" },
          { subject: "Französisch", pct: 45, color: "bg-accent/40" },
        ].map((item) => (
          <div key={item.subject} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-foreground/80">
                {item.subject}
              </span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {item.pct}%
              </span>
            </div>
            <div className="h-1 rounded-full bg-muted/30">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${item.pct}%` }}
                viewport={{ once: true }}
                transition={{
                  duration: 1.2,
                  delay: 0.2,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
                className={`h-full rounded-full ${item.color}`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 border-t border-border/40 pt-2.5">
        {[
          { value: "62%", label: "Gesamt" },
          { value: "5,2h", label: "Woche" },
          { value: "+12%", label: "z. Vorw." },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-[12px] font-medium leading-none tracking-[-0.01em] text-foreground">
              {stat.value}
            </p>
            <p className="mt-0.5 text-[9px] text-muted-foreground/60">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepCard({ card }: { readonly card: LoopCard }) {
  return (
    <div className="group/card relative flex flex-col overflow-hidden rounded-xl border border-border bg-background p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] transition-all duration-300 hover:border-foreground/20 hover:shadow-[0_1px_3px_rgba(0,0,0,0.04),0_12px_28px_-12px_rgba(0,0,0,0.12)] sm:p-7 dark:border-border/60 dark:bg-background dark:shadow-[0_1px_0_0_rgb(255_255_255_/_0.05),0_8px_24px_-12px_rgba(0,0,0,0.45)] dark:hover:border-foreground/30">
      <CardHeader icon={card.icon} step={card.step} title={card.title} />
      <p className="mt-3 text-[13px] leading-[1.5] text-muted-foreground">
        {card.description}
      </p>
      <div className="mt-5 flex-1 flex flex-col justify-end">
        {card.title === "Lernen" && <LearnPreview />}
        {card.title === "KI fragen" && <AskAiPreview />}
        {card.title === "Üben" && <PracticePreview />}
        {card.title === "Fehler analysieren" && <MistakesPreview />}
        {card.title === "Wiederholen" && <ReviewPreview />}
        {card.title === "Meistern" && <MasterPreview />}
      </div>
    </div>
  );
}

export function LearningLoop() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section
      id="loop"
      ariaLabelledBy="loop-title"
      className="relative overflow-hidden border-t border-border bg-background py-24 sm:py-32"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="loop-title"
          align="center"
          title={
            <>
              Der Lernkreislauf
              <br />
              für Gymnasialfächer.
            </>
          }
          description={
            <>
              Synedrix vereint Lehrplan, Practice Engine, KI-Tutor und Spaced Repetition.
              Jeder Schritt teilt denselben Kontext, sodass der Tutor genau weiß, wo du Probleme hattest
              und was als Nächstes fällig ist.
            </>
          }
        />
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 sm:gap-8"
      >
        {CARDS.map((card) => (
          <StepCard key={card.title} card={card} />
        ))}
      </motion.div>
    </Section>
  );
}

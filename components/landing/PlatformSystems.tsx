"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

import { Section, SectionHeading } from "@/components/landing/ui/Section";
import {
  ChatCircleText,
  Target,
  ClockCounterClockwise,
  Notebook,
  Gauge,
} from "@/components/landing/icons";
import type { PhosphorIconComponent } from "@/components/landing/icons";

interface Tab {
  readonly id: string;
  readonly label: string;
  readonly icon: PhosphorIconComponent;
  readonly macOsTitle: string;
}

const TABS: readonly Tab[] = [
  { id: "tutor", label: "Tutor", icon: ChatCircleText, macOsTitle: "KI-Tutor" },
  { id: "practice", label: "Üben", icon: Target, macOsTitle: "Übungsarena" },
  { id: "review", label: "Wiederholen", icon: ClockCounterClockwise, macOsTitle: "Wiederholungen" },
  { id: "notes", label: "Notizen", icon: Notebook, macOsTitle: "Notiz-Editor" },
  { id: "analytics", label: "Analysen", icon: Gauge, macOsTitle: "Lernstandsanalyse" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function WindowDots() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      <span className="h-2 w-2 rounded-full bg-rose-400/80" />
      <span className="h-2 w-2 rounded-full bg-amber-400/80" />
      <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
    </div>
  );
}

function BrowserWindow({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_0_0_rgb(255_255_255_/_0.05),0_8px_24px_-12px_rgba(0,0,0,0.45)]">
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

function TabBar({
  active,
  onSelect,
}: {
  readonly active: TabId;
  readonly onSelect: (id: TabId) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border w-full justify-start sm:justify-center overflow-x-auto pb-px">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px shrink-0 ${
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground/70 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" weight={isActive ? "duotone" : "regular"} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function TutorPanel() {
  return (
    <div className="flex flex-col lg:flex-row">
      {/* Conversation */}
      <div className="flex-1 space-y-4 p-6">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3 mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <p className="text-[10px] font-mono font-medium text-accent uppercase tracking-[0.05em]">
            Lehrplan-Kontext aktiv &middot; Kennt letzte Fehler
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-md bg-muted-foreground/5 px-3 py-2 text-[12px] leading-relaxed text-foreground/80">
              Ich verwechsle ständig Kettenregel und Produktregel. Kannst du helfen?
            </div>
          </div>

          <div className="flex justify-start">
            <div className="max-w-[90%] space-y-2 border-l border-accent/40 pl-3 py-0.5">
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Der Hauptunterschied: Die <strong>Kettenregel</strong> behandelt verschachtelte
                Funktionen (f in g), während die <strong>Produktregel</strong>{" "}
                für multiplizierte Funktionen gilt.
              </p>
              <div className="rounded bg-accent/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-accent">
                Kettenregel: d/dx f(g(x)) = f&prime;(g(x)) &middot; g&prime;(x)
                <br />
                Produktregel: d/dx [u(x)&middot;v(x)] = u&prime;v + uv&prime;
              </div>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Frage dich selbst: „Steht eine Funktion in der anderen (Kettenregel) oder stehen sie nebeneinander (Produktregel)?“
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="max-w-[65%] rounded-md bg-muted-foreground/5 px-3 py-2 text-[12px] leading-relaxed text-foreground/80">
              Das ergibt Sinn. Kannst du mir eine Übungsaufgabe geben?
            </div>
          </div>

          <div className="flex items-center gap-1.5 pl-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/35" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/35 [animation-delay:0.15s]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/35 [animation-delay:0.3s]" />
          </div>
        </div>
      </div>

      {/* Sidebar actions */}
      <div className="flex flex-row gap-4 p-5 lg:w-44 lg:flex-col border-t lg:border-t-0 lg:border-l border-border/60 overflow-x-auto shrink-0">
        <p className="text-[10px] font-mono font-medium uppercase tracking-[0.1em] text-muted-foreground/60 hidden lg:block">
          Vorgeschlagene Aktionen
        </p>
        <div className="flex lg:flex-col gap-2">
          {["Einfacher erklären", "Gib mir einen Tipp", "Lösung überprüfen", "Abfragen"].map(
            (action) => (
              <button
                key={action}
                type="button"
                className="text-left text-[12px] text-muted-foreground hover:text-foreground transition-colors py-1 lg:py-0.5 whitespace-nowrap"
              >
                &rarr; {action}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function PracticePanel() {
  return (
    <div className="flex flex-col lg:flex-row">
      <div className="flex-1 space-y-4 p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Aufgabe 3 von 10
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              04:32
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">
                Kettenregel &middot; Produktregel
              </p>
              <p className="mt-1 text-[13.5px] font-medium leading-snug text-foreground">
                Bestimme die Ableitung von sin(x&sup2;) &middot; e<sup>3x</sup>
              </p>
            </div>

            <div className="space-y-2">
              {[
                { text: "cos(x²) · e³ˣ + sin(x²) · 3e³ˣ", state: "selected" as const },
                { text: "cos(x²) · 3e³ˣ", state: "default" as const },
                { text: "2x cos(x²) · e³ˣ + sin(x²) · 3e³ˣ", state: "correct" as const },
                { text: "sin(x²) · e³ˣ · (2x + 3)", state: "default" as const },
              ].map((opt, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-1.5 text-[12.5px]"
                >
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    opt.state === "correct"
                      ? "border-emerald-500"
                      : opt.state === "selected"
                        ? "border-accent"
                        : "border-border"
                  }`}>
                    {opt.state === "correct" && (
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                    {opt.state === "selected" && (
                      <div className="h-2 w-2 rounded-full bg-accent" />
                    )}
                  </div>
                  <span className={
                    opt.state === "correct"
                      ? "font-medium text-emerald-600 dark:text-emerald-400"
                      : opt.state === "selected"
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                  }>
                    {opt.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-l border-accent/40 pl-3 py-0.5">
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Richtig.</span> Du hast sowohl
                die Produktregel als auch die Kettenregel angewendet. Der erste
                Term nutzt 2x aus der inneren Ableitung von sin(x&sup2;).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right progress panel */}
      <div className="flex flex-row gap-4 p-5 lg:w-56 lg:flex-col border-t lg:border-t-0 lg:border-l border-border/60 overflow-x-auto shrink-0">
        <p className="text-[10px] font-mono font-medium uppercase tracking-[0.1em] text-muted-foreground/60 hidden lg:block">
          Übungsfortschritt
        </p>
        <div className="flex flex-col gap-4 w-full">
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-sm ${
                  i < 3
                    ? "bg-accent"
                    : i === 3
                      ? "bg-accent/30 ring-1 ring-accent"
                      : "bg-muted/40"
                }`}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-3 pt-2">
            {[
              { value: "3/10", label: "Erledigt" },
              { value: "87%", label: "Genauigkeit" },
              { value: "04:32", label: "Zeit" },
            ].map((s) => (
              <div key={s.label} className="text-left">
                <p className="text-[13px] font-medium text-foreground">
                  {s.value}
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewPanel() {
  const milestones = [
    { label: "Heute", active: true, count: 4 },
    { label: "Morgen", active: false, count: 6 },
    { label: "3 Tage", active: false, count: 8 },
    { label: "7 Tage", active: false, count: 11 },
    { label: "30 Tage", active: false, count: 24 },
  ];

  return (
    <div className="flex flex-col">
      {/* Timeline header */}
      <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
        <div className="flex items-center gap-6 overflow-x-auto w-full">
          {milestones.map((m) => (
            <div key={m.label} className="flex items-center gap-2 shrink-0">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  m.active ? "bg-accent" : "bg-muted"
                }`}
              />
              <span className={`text-[12px] font-medium ${m.active ? "text-accent" : "text-muted-foreground"}`}>
                {m.label}
              </span>
              <span className="text-[10px] text-muted-foreground/45">
                ({m.count})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews list row */}
      <div className="grid grid-cols-1 gap-y-4 gap-x-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Definitionsbereich log₂(x)", subject: "Mathematik", due: "Heute", interval: "1 Tag" },
          { title: "Subjonctif présent", subject: "Französisch", due: "Heute", interval: "3 Tage" },
          { title: "Newtons 2. Gesetz", subject: "Physik", due: "Morgen", interval: "2 Tage" },
          { title: "Mendelsche Regeln", subject: "Biologie", due: "3 Tage", interval: "7 Tage" },
          { title: "Kettenregel-Anwendungen", subject: "Mathematik", due: "7 Tage", interval: "14 Tage" },
          { title: "Chemisches Gleichgewicht", subject: "Chemie", due: "30 Tage", interval: "30 Tage" },
        ].map((card) => (
          <div
            key={card.title}
            className="flex flex-col py-1.5 border-b border-border/40 last:border-0"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  card.due === "Heute" ? "bg-accent" : "bg-muted"
                }`}
              />
              <span className="text-[10px] font-mono font-medium uppercase tracking-[0.05em] text-muted-foreground/60">
                {card.subject}
              </span>
            </div>
            <p className="mt-1 text-[13px] font-medium leading-snug text-foreground">
              {card.title}
            </p>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground/75">
              <span>Fällig: {card.due}</span>
              <span>&middot;</span>
              <span>Intervall: {card.interval}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotesPanel() {
  return (
    <div className="flex flex-col lg:flex-row">
      {/* Sidebar */}
      <div className="flex flex-row gap-4 p-5 lg:w-48 lg:flex-col border-b lg:border-b-0 lg:border-r border-border/60 overflow-x-auto shrink-0">
        <p className="text-[10px] font-mono font-medium uppercase tracking-[0.1em] text-muted-foreground/60 hidden lg:block">
          Notizen
        </p>
        <div className="flex lg:flex-col gap-1.5 w-full">
          {[
            "Kettenregel erklärt",
            "Partielle Integration",
            "Grenzwerte & Stetigkeit",
            "Ableitungsregeln",
            "Übungsaufgaben",
          ].map((note, i) => (
            <button
              key={note}
              type="button"
              className={`text-left px-2.5 py-1 text-[12px] rounded transition-colors whitespace-nowrap ${
                i === 0
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/5"
              }`}
            >
              {note}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 p-6">
        <div className="space-y-4">
          <h3 className="text-[16px] font-medium leading-[1.2] tracking-[-0.01em] text-foreground">
            Die Kettenregel
          </h3>

          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Die Kettenregel wird verwendet, um verschachtelte <strong>Funktionen</strong> abzuleiten. Wenn eine Funktion
            in einer anderen steht, leite zuerst die äußere ab und multipliziere das Ergebnis mit der Ableitung der inneren.
          </p>

          <div className="border-l border-accent/40 pl-3 py-1 font-mono text-[13px] text-foreground/80 my-3">
            d/dx f(g(x)) = f&prime;(g(x)) &middot; g&prime;(x)
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>Tags:</span>
            {["Analysis", "Ableitungen", "Verkettung"].map((tag) => (
              <span key={tag} className="font-mono text-[10.5px] text-accent">
                #{tag.toLowerCase().replace(" ", "-")}
              </span>
            ))}
          </div>

          <div className="flex items-start gap-2.5 border-t border-border/40 pt-4 mt-4">
            <span className="mt-0.5 shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[9px] font-medium text-accent">
              KI
            </span>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground/80">
                Nächste Schritte
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Das Grundmuster sitzt. Versuche als Nächstes eine Aufgabe mit mehrfach verschachtelter Kettenregel.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsPanel() {
  return (
    <div className="flex flex-col lg:flex-row gap-8 p-6">
      {/* Left column: Mastery overview & Weekly graph */}
      <div className="flex-1 space-y-8">
        {/* Subject Mastery */}
        <div className="space-y-4">
          <p className="text-[10px] font-mono font-medium uppercase tracking-[0.1em] text-muted-foreground/60">
            Fach-Lernstand
          </p>
          <div className="space-y-3">
            {[
              { subject: "Mathematik", pct: 78, color: "bg-accent" },
              { subject: "Physik", pct: 62, color: "bg-accent/80" },
              { subject: "Französisch", pct: 45, color: "bg-accent/60" },
              { subject: "Chemie", pct: 34, color: "bg-accent/40" },
              { subject: "Biologie", pct: 28, color: "bg-accent/20" },
            ].map((item) => (
              <div key={item.subject} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[12px] font-medium text-foreground/75">
                  {item.subject}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/20">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${item.pct}%` }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 1,
                      delay: 0.3,
                      ease: [0.22, 0.61, 0.36, 1],
                    }}
                    className={`h-full rounded-full ${item.color}`}
                  />
                </div>
                <span className="w-8 text-right font-mono text-[11px] tabular-nums text-muted-foreground/60">
                  {item.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Graph */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono font-medium uppercase tracking-[0.1em] text-muted-foreground/60">
              Wöchentliche Lernstunden
            </p>
            <span className="text-[11px] text-muted-foreground/60">
              Diese Woche: 5,2h &middot; Letzte Woche: 4,1h
            </span>
          </div>
          <div className="flex items-end gap-3 pt-4" style={{ height: 100 }}>
            {[
              { day: "Mon", hours: 1.2 },
              { day: "Die", hours: 0.8 },
              { day: "Mit", hours: 1.5 },
              { day: "Don", hours: 0.3 },
              { day: "Fre", hours: 0.9 },
              { day: "Sam", hours: 0.5 },
              { day: "Son", hours: 0 },
            ].map((d) => (
              <div
                key={d.day}
                className="flex flex-1 flex-col items-center gap-1.5"
              >
                <div className="w-full bg-muted/10 rounded-t-sm h-full flex flex-col justify-end">
                  <motion.div
                    initial={{ height: 0 }}
                    whileInView={{ height: `${(d.hours / 1.5) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.8,
                      delay: 0.4,
                      ease: [0.22, 0.61, 0.36, 1],
                    }}
                    className="w-full rounded-t-sm bg-accent/80"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground/60">
                  {d.day}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right column: Stats Grid */}
      <div className="lg:w-56 space-y-4 shrink-0">
        <p className="text-[10px] font-mono font-medium uppercase tracking-[0.1em] text-muted-foreground/60">
          Lernstands-Metriken
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
          {[
            { value: "8", label: "Wochen-Streak", unit: "Tage" },
            { value: "87", label: "Selbstvertrauen", unit: "%" },
            { value: "5,2", label: "Lernzeit", unit: "Stunden" },
            { value: "74", label: "Prüfungsreife", unit: "%" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border-b border-border/40 pb-3 last:border-0"
            >
              <p className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">
                {stat.value}
                <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">
                  {stat.unit}
                </span>
              </p>
              <p className="text-[10.5px] text-muted-foreground/75">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivePanel({ tab }: { readonly tab: TabId }) {
  switch (tab) {
    case "tutor":
      return <TutorPanel />;
    case "practice":
      return <PracticePanel />;
    case "review":
      return <ReviewPanel />;
    case "notes":
      return <NotesPanel />;
    case "analytics":
      return <AnalyticsPanel />;
    default:
      return null;
  }
}

export function PlatformSystems() {
  const [active, setActive] = useState<TabId>("tutor");
  const reduce = useReducedMotion() ?? false;

  const activeTab = TABS.find((t) => t.id === active)!;

  return (
    <Section
      id="platform"
      ariaLabelledBy="platform-title"
      className="relative overflow-hidden bg-background py-24 sm:py-32"
    >
      {/* Headline */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="platform-title"
          align="center"
          title={
            <>
              Fünf Werkzeuge mit einem
              <br />
              gemeinsamen Lehrplan-Kontext.
            </>
          }
          description={
            <>
              Synedrix hält deinen Tutor, deine Übungen, Wiederholungen, Notizen und Erfolge
              perfekt miteinander verbunden. Jede Aktion aktualisiert den gemeinsamen Zustand.
            </>
          }
        />
      </motion.div>

      {/* Tab bar */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="relative mt-14 flex justify-center w-full"
      >
        <TabBar active={active} onSelect={setActive} />
      </motion.div>

      {/* Browser window with preview */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto mt-10 max-w-5xl"
      >
        <BrowserWindow title={activeTab.macOsTitle}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={reduce ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 1 } : { opacity: 0, x: -12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <ActivePanel tab={active} />
            </motion.div>
          </AnimatePresence>
        </BrowserWindow>
      </motion.div>
    </Section>
  );
}

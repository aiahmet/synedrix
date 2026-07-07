"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

import { Section, SectionHeading } from "@/components/landing/ui/Section";
import {
  MathOperations,
  Flask,
  AtomIcon,
  ClockCounterClockwise,
  Compass,
} from "@/components/landing/icons";
import type { PhosphorIconComponent } from "@/components/landing/icons";

interface SubjectSlide {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly features: readonly string[];
  readonly tutorMode: string;
  readonly icon: PhosphorIconComponent;
}

const SUBJECTS: readonly SubjectSlide[] = [
  {
    id: "math",
    name: "Mathematik",
    blurb: "LaTeX-Darstellung, interaktive Koordinatensysteme und gestaffeltes KI-Feedback.",
    features: [
      "Mathematische LaTeX-Notation",
      "Gestaffelte Hinweise statt direkter Lösungen",
      "Geometrische und Koordinaten-Plots",
    ],
    tutorMode: "Hinweisleiter",
    icon: MathOperations,
  },
  {
    id: "physics",
    name: "Physik",
    blurb: "Einheitenanalyse, interaktive Kraftdiagramme und sokratische Herleitung.",
    features: [
      "Einheitenrechner und -validierung",
      "Kraftvektoren und Diagramm-Werkzeug",
      "Deduktiver KI-Chatbot",
    ],
    tutorMode: "Sokratische Abfrage",
    icon: Flask,
  },
  {
    id: "chemistry",
    name: "Chemie",
    blurb: "Ausgleichen chemischer Gleichungen, molekulare Strukturen und Reaktionsabläufe.",
    features: [
      "Stöchiometrie-Berechnungs-Engine",
      "Interaktiver 3D-Molekülbetrachter",
      "Reaktionsgleichungs-Ausgleich",
    ],
    tutorMode: "Schrittweise Prüfung",
    icon: AtomIcon,
  },
  {
    id: "biology",
    name: "Biologie",
    blurb: "Anatomie-Karteikarten, Genetik-Rechner und Vokabel-Lernstandsgraphen.",
    features: [
      "Punnett-Quadrat-Rechner",
      "Interaktive Anatomie-Diagramme",
      "Concept-Map-Generator",
    ],
    tutorMode: "Genetik-Prüfung",
    icon: Compass,
  },
  {
    id: "history",
    name: "Geschichte",
    blurb: "Zeitstrahl-Generatoren, Quellenanalyseraster und historische Quellenkritik.",
    features: [
      "Interaktiver Zeitstrahl",
      "Quellenkritik-Checklisten",
      "Aufsatz-Strukturierungsraum",
    ],
    tutorMode: "Quellenkritik",
    icon: ClockCounterClockwise,
  },
] as const;

function MathPreview() {
  return (
    <div className="relative flex h-full w-full flex-col justify-between p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.05em] text-muted-foreground/60">
          Koordinaten-Plot
        </span>
        <span className="font-mono text-[9.5px] text-accent">
          f(x) = x³ - 3x
        </span>
      </div>
      <div className="relative flex-1 flex items-center justify-center min-h-[140px] mt-2">
        <svg viewBox="0 0 120 120" className="h-full w-full max-h-[160px] text-border">
          {/* Grid lines */}
          <line x1="10" y1="30" x2="110" y2="30" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" className="opacity-45" />
          <line x1="10" y1="90" x2="110" y2="90" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" className="opacity-45" />
          <line x1="30" y1="10" x2="30" y2="110" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" className="opacity-45" />
          <line x1="90" y1="10" x2="90" y2="110" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" className="opacity-45" />

          {/* Axes */}
          <line x1="10" y1="60" x2="110" y2="60" stroke="currentColor" strokeWidth="0.75" />
          <line x1="60" y1="10" x2="60" y2="110" stroke="currentColor" strokeWidth="0.75" />

          {/* Shaded Area under Curve (Integration preview) */}
          <path
            d="M 60 60 Q 75 15, 90 60"
            fill="var(--accent)"
            fillOpacity="0.08"
          />
          <line x1="90" y1="60" x2="90" y2="60" stroke="var(--accent)" strokeWidth="1" strokeDasharray="2 2" />

          {/* Plot curve */}
          <path
            d="M 20 100 C 40 100, 50 85, 60 60 C 70 35, 80 20, 100 20"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
          />

          {/* Projection/Axis labels */}
          <circle cx="90" cy="60" r="2.5" fill="var(--accent)" />
          <text x="94" y="64" className="font-mono text-[7.5px] fill-muted-foreground">x₁</text>
        </svg>
      </div>
    </div>
  );
}

function PhysicsPreview() {
  return (
    <div className="relative flex h-full w-full flex-col justify-between p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.05em] text-muted-foreground/60">
          Kräfte am Keil
        </span>
        <span className="font-mono text-[9.5px] text-accent">
          F_hang = F_g &middot; sin(α)
        </span>
      </div>
      <div className="relative flex-1 flex items-center justify-center min-h-[140px] mt-2">
        <svg viewBox="0 0 120 120" className="h-full w-full max-h-[160px] text-border">
          {/* Inclined Plane */}
          <polygon points="10,90 110,90 110,40" fill="none" stroke="currentColor" strokeWidth="1" />
          
          {/* Angle indicator */}
          <path d="M 25 90 A 15 15 0 0 0 23 78" fill="none" stroke="currentColor" strokeWidth="0.75" />
          <text x="28" y="86" className="font-mono text-[8px] fill-muted-foreground">α</text>

          {/* Block on incline (rotated 26.5 degrees) */}
          <g transform="translate(60, 65) rotate(-26.5)">
            <rect x="-15" y="-10" width="30" height="20" fill="var(--background)" stroke="currentColor" strokeWidth="1" />
            
            {/* Center of Mass point */}
            <circle cx="0" cy="0" r="1.5" fill="currentColor" />

            {/* Normal Force (Fn) arrow */}
            <line x1="0" y1="0" x2="0" y2="-30" stroke="currentColor" strokeWidth="1" />
            <polygon points="-2,-26 0,-30 2,-26" fill="currentColor" />
            <text x="4" y="-22" className="font-mono text-[7px] fill-muted-foreground">Fn</text>

            {/* Friction Force (Ff) arrow */}
            <line x1="0" y1="0" x2="-25" y2="0" stroke="currentColor" strokeWidth="1" />
            <polygon points="-21,-2 -25,0 -21,2" fill="currentColor" />
            <text x="-24" y="-5" className="font-mono text-[7px] fill-muted-foreground">Fr</text>

            {/* Gravitational Force (Fg) - must point straight down in global space.
                To point down globals (angle of incline is -26.5 deg), we rotate it 26.5 deg inside the group */}
            <g transform="rotate(26.5)">
              <line x1="0" y1="0" x2="0" y2="35" stroke="var(--accent)" strokeWidth="1.5" />
              <polygon points="-2.5,30 0,35 2.5,30" fill="var(--accent)" />
              <text x="5" y="32" className="font-mono text-[8px] fill-accent font-medium">Fg</text>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

function ChemistryPreview() {
  return (
    <div className="relative flex h-full w-full flex-col justify-between p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.05em] text-muted-foreground/60">
          Molekülstruktur
        </span>
        <span className="font-mono text-[9.5px] text-accent">
          H₂O &middot; 104.5°
        </span>
      </div>
      <div className="relative flex-1 flex items-center justify-center min-h-[140px] mt-2">
        <svg viewBox="0 0 120 120" className="h-full w-full max-h-[160px] text-border">
          {/* Valence electron pair representations (subtle lines) */}
          <line x1="60" y1="45" x2="25" y2="80" stroke="currentColor" strokeWidth="1.5" className="text-border-strong" />
          <line x1="60" y1="45" x2="95" y2="80" stroke="currentColor" strokeWidth="1.5" className="text-border-strong" />

          {/* Oxygen (Center top) */}
          <g>
            <circle cx="60" cy="45" r="16" fill="var(--background)" stroke="var(--accent)" strokeWidth="1.5" />
            {/* Double valence dots on top */}
            <circle cx="56" cy="36" r="1.2" fill="var(--accent)" />
            <circle cx="64" cy="36" r="1.2" fill="var(--accent)" />
            <text x="60" y="49" textAnchor="middle" className="font-mono text-[11px] font-bold fill-accent">O</text>
          </g>

          {/* Hydrogen 1 (Bottom Left) */}
          <g>
            <circle cx="25" cy="80" r="11" fill="var(--background)" stroke="currentColor" strokeWidth="1" />
            <text x="25" y="83.5" textAnchor="middle" className="font-mono text-[9px] font-medium fill-foreground">H</text>
          </g>

          {/* Hydrogen 2 (Bottom Right) */}
          <g>
            <circle cx="95" cy="80" r="11" fill="var(--background)" stroke="currentColor" strokeWidth="1" />
            <text x="95" y="83.5" textAnchor="middle" className="font-mono text-[9px] font-medium fill-foreground">H</text>
          </g>

          {/* Angle arc overlay */}
          <path d="M 49 55 A 14 14 0 0 0 71 55" fill="none" stroke="var(--accent)" strokeWidth="0.75" strokeDasharray="1.5 1.5" />
        </svg>
      </div>
    </div>
  );
}

function BiologyPreview() {
  return (
    <div className="relative flex h-full w-full flex-col justify-between p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.05em] text-muted-foreground/60">
          Genetik
        </span>
        <span className="font-mono text-[9.5px] text-accent">
          Mendel-Vererbung
        </span>
      </div>
      <div className="relative flex-1 flex items-center justify-center min-h-[140px] mt-2">
        <div className="overflow-hidden rounded-lg border border-border bg-background w-full max-w-[160px]">
          <table className="w-full border-collapse text-[11px] font-mono text-center">
            <tbody>
              <tr className="bg-muted/10 border-b border-border">
                <td className="p-2 border-r border-border font-bold text-muted-foreground/60">♀\♂</td>
                <td className="p-2 border-r border-border font-bold text-accent">G</td>
                <td className="p-2 font-bold text-accent">g</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-2 bg-muted/10 border-r border-border font-bold text-accent">G</td>
                <td className="p-2 border-r border-border text-foreground font-medium bg-background">GG</td>
                <td className="p-2 text-foreground font-medium bg-background">Gg</td>
              </tr>
              <tr>
                <td className="p-2 bg-muted/10 border-r border-border font-bold text-accent">g</td>
                <td className="p-2 border-r border-border text-foreground font-medium bg-background">Gg</td>
                <td className="p-2 text-foreground font-medium bg-background">gg</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HistoryPreview() {
  return (
    <div className="relative flex h-full w-full flex-col justify-between p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.05em] text-muted-foreground/60">
          Zeitstrahl
        </span>
        <span className="font-mono text-[9.5px] text-accent">
          Historische Ereignisse
        </span>
      </div>
      <div className="relative flex-1 flex flex-col justify-center min-h-[140px] pl-3 border-l border-border/60 mt-4 space-y-2.5">
        {[
          { year: "1918", label: "Novemberrevolution" },
          { year: "1923", label: "Hyperinflation" },
          { year: "1929", label: "Weltwirtschaftskrise" },
        ].map((event) => (
          <div key={event.year} className="relative flex flex-col items-start leading-none pl-3 group/event">
            <span className="absolute left-[-16px] top-1.5 h-2 w-2 rounded-full border border-accent bg-background transition-transform group-hover/event:scale-125" />
            <div className="rounded border border-border/60 bg-background px-2 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <span className="text-[9px] font-mono font-semibold text-accent">{event.year}</span>
              <p className="text-[10.5px] font-medium text-foreground mt-0.5">{event.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlidePreview({ id }: { readonly id: string }) {
  switch (id) {
    case "math":
      return <MathPreview />;
    case "physics":
      return <PhysicsPreview />;
    case "chemistry":
      return <ChemistryPreview />;
    case "biology":
      return <BiologyPreview />;
    case "history":
      return <HistoryPreview />;
    default:
      return null;
  }
}

export function SubjectCarousel() {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion() ?? false;

  const handleNext = () => setIndex((i) => (i + 1) % SUBJECTS.length);
  const handlePrev = () => setIndex((i) => (i - 1 + SUBJECTS.length) % SUBJECTS.length);

  const active = SUBJECTS[index];
  const ActiveIcon = active.icon;

  return (
    <Section
      id="subjects-carousel"
      ariaLabelledBy="carousel-title"
      className="relative overflow-hidden bg-background py-24 sm:py-32"
    >
      {/* Title */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="carousel-title"
          align="center"
          title={
            <>
              Fachspezifische Abläufe
              <br />
              für das Gymnasium.
            </>
          }
          description={
            <>
              Unterschiedliche Fächer erfordern unterschiedliche Lernmethoden. Synedrix passt
              die Benutzeroberfläche an das jeweilige Fach an, damit du immer das richtige Werkzeug nutzt.
            </>
          }
        />
      </motion.div>

      {/* Main slide frame */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto mt-16 max-w-4xl"
      >
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] dark:border-border/60 dark:shadow-[0_1px_0_0_rgb(255_255_255_/_0.05),0_8px_24px_-12px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col md:flex-row min-h-[300px]">
            {/* Slide content */}
            <div className="flex-1 p-6 sm:p-8 space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id}
                  initial={reduce ? false : { opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 1 } : { opacity: 0, x: -12 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-5"
                >
                  <div className="flex items-center gap-2">
                    <ActiveIcon className="h-5 w-5 text-muted-foreground/80" weight="duotone" />
                    <h3 className="text-[15px] font-semibold tracking-tight text-foreground sm:text-[16px]">
                      {active.name}
                    </h3>
                  </div>

                  <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                    {active.blurb}
                  </p>

                  <ul className="space-y-2">
                    {active.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-[12.5px] text-muted-foreground">
                        <span className="text-foreground/30 font-mono" aria-hidden>&mdash;</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center gap-2 pt-2 text-[11px] text-muted-foreground/60">
                    <span className="font-medium text-foreground">Tutor-Modus:</span>
                    <span>{active.tutorMode}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Slide preview panel */}
            <div className="w-full md:w-[280px] bg-muted/10 border-t md:border-t-0 md:border-l border-border/60 shrink-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id}
                  initial={reduce ? false : { opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full"
                >
                  <SlidePreview id={active.id} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Navigation arrow buttons */}
        <div className="mt-6 flex items-center justify-between px-2">
          <div className="flex items-center gap-1.5">
            {SUBJECTS.map((sub, i) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? "w-5 bg-accent"
                    : "w-1.5 bg-muted-foreground/20 hover:bg-muted-foreground/45"
                }`}
                aria-label={`Gehe zu Fach ${sub.name}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="inline-flex h-8 w-12 items-center justify-center rounded-md border border-border bg-background text-[13px] font-medium text-foreground transition-colors hover:bg-muted/10"
            >
              &larr;
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex h-8 w-12 items-center justify-center rounded-md border border-border bg-background text-[13px] font-medium text-foreground transition-colors hover:bg-muted/10"
            >
              &rarr;
            </button>
          </div>
        </div>
      </motion.div>
    </Section>
  );
}

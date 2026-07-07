"use client";

import { motion, useReducedMotion } from "motion/react";

import { Section, SectionHeading } from "@/components/landing/ui/Section";
import {
  GraduationCap,
  ClipboardText,
  ShieldCheck,
  MathOperations,
  Flask,
  AtomIcon,
  DnaIcon,
  BookOpenIcon,
  User,
} from "@/components/landing/icons";
import type { PhosphorIconComponent } from "@/components/landing/icons";

interface FeatureItem {
  readonly title: string;
  readonly description: string;
  readonly icon: PhosphorIconComponent;
}

const FEATURES: readonly FeatureItem[] = [
  {
    title: "Lehrplangestützt",
    description: "Jedes Konzept ist mit den offiziellen Abitur-Anforderungen verknüpft.",
    icon: GraduationCap,
  },
  {
    title: "Fehlerjournal-Sync",
    description: "Fehler beim Üben fließen direkt in zukünftige Tutor-Gespräche ein.",
    icon: ClipboardText,
  },
  {
    title: "Privatsphäre zuerst",
    description: "Deine Daten gehören dir und werden niemals für das Training externer KI-Modelle genutzt.",
    icon: ShieldCheck,
  },
] as const;

function FeatureList() {
  return (
    <ul className="space-y-6">
      {FEATURES.map((feat) => {
        const Icon = feat.icon;
        return (
          <li key={feat.title} className="flex gap-4">
            <Icon className="h-5 w-5 shrink-0 text-muted-foreground/80 mt-0.5" weight="duotone" />
            <div>
              <h4 className="text-[13.5px] font-medium leading-[1.2] text-foreground">
                {feat.title}
              </h4>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {feat.description}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

interface GraphNode {
  readonly id: string;
  readonly label: string;
  readonly icon: PhosphorIconComponent;
  readonly cx: number;
  readonly cy: number;
  readonly mastery: number;
  readonly mistakes: number;
  readonly reviews: number;
}

const NODES: readonly GraphNode[] = [
  {
    id: "math",
    label: "Mathe",
    icon: MathOperations,
    cx: 200,
    cy: 70,
    mastery: 78,
    mistakes: 0,
    reviews: 1,
  },
  {
    id: "physics",
    label: "Physik",
    icon: Flask,
    cx: 65,
    cy: 155,
    mastery: 62,
    mistakes: 1,
    reviews: 0,
  },
  {
    id: "french",
    label: "Französisch",
    icon: BookOpenIcon,
    cx: 335,
    cy: 155,
    mastery: 45,
    mistakes: 0,
    reviews: 1,
  },
  {
    id: "chemistry",
    label: "Chemie",
    icon: AtomIcon,
    cx: 115,
    cy: 305,
    mastery: 34,
    mistakes: 3,
    reviews: 0,
  },
  {
    id: "biology",
    label: "Biologie",
    icon: DnaIcon,
    cx: 285,
    cy: 305,
    mastery: 28,
    mistakes: 0,
    reviews: 0,
  },
] as const;

function GraphView() {
  const reduce = useReducedMotion() ?? false;

  return (
    <div className="relative mx-auto flex w-full max-w-[480px] justify-center items-center shrink-0">
      <svg
        viewBox="0 0 400 400"
        className="w-full h-auto overflow-visible select-none text-border"
      >
        {/* Connection lines */}
        {NODES.map((node) => (
          <line
            key={`line-${node.id}`}
            x1="200"
            y1="200"
            x2={node.cx}
            y2={node.cy}
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="4 3"
            className="text-border/40 dark:text-border/30"
          />
        ))}

        {/* Central Node (Student - Du) */}
        <g>
          <circle
            cx="200"
            cy="200"
            r="24"
            fill="var(--background)"
            stroke="currentColor"
            strokeWidth="1"
            className="text-border-strong"
          />
          <foreignObject x="190" y="190" width="20" height="20" className="overflow-visible">
            <User className="h-5 w-5 text-foreground" weight="duotone" />
          </foreignObject>
          <foreignObject x="175" y="228" width="50" height="20" className="overflow-visible">
            <div className="text-center font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-foreground/80 leading-none">
              Du
            </div>
          </foreignObject>
        </g>

        {/* Satellites */}
        {NODES.map((node) => {
          const r = 23;
          const circum = 2 * Math.PI * r;
          const strokeOffset = circum * (1 - node.mastery / 100);

          return (
            <g key={node.id}>
              {/* HTML Info Card Stack */}
              <foreignObject
                x={node.cx - 60}
                y={node.cy + 28}
                width="120"
                height="35"
                className="overflow-visible"
              >
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="text-[11.5px] font-medium tracking-tight text-foreground leading-[1.2]">
                    {node.label}
                  </span>
                  <span className="mt-0.5 text-[9.5px] font-mono text-muted-foreground/75 leading-none">
                    {node.mastery}% &middot; {node.reviews > 0 ? `${node.reviews} Wdh.` : `${node.mistakes} Fehler`}
                  </span>
                </div>
              </foreignObject>

              {/* Outer Progress Ring */}
              <circle
                cx={node.cx}
                cy={node.cy}
                r={r}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-muted/15 dark:text-muted/10"
              />

              {/* Active Progress Ring Arc */}
              <circle
                cx={node.cx}
                cy={node.cy}
                r={r}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.5"
                strokeDasharray={circum}
                strokeDashoffset={reduce ? 0 : strokeOffset}
                transform={`rotate(-90 ${node.cx} ${node.cy})`}
                strokeLinecap="round"
              />

              {/* Node Center Fill */}
              <circle
                cx={node.cx}
                cy={node.cy}
                r={18}
                fill="var(--background)"
                stroke="currentColor"
                strokeWidth="1"
                className="text-border"
              />

              {/* duotone Icon */}
              <foreignObject
                x={node.cx - 9}
                y={node.cy - 9}
                width="18"
                height="18"
                className="overflow-visible"
              >
                <node.icon className="h-[18px] w-[18px] text-muted-foreground/80" weight="duotone" />
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AdaptiveAI() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section
      id="adaptive"
      ariaLabelledBy="adaptive-title"
      className="relative overflow-hidden border-t border-border bg-background py-24 sm:py-32"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-16 lg:flex-row lg:items-start lg:gap-14">
        {/* Left column: Content */}
        <div className="flex-1 space-y-10">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <SectionHeading
              titleId="adaptive-title"
              title={
                <>
                  Kontinuierlicher Kontext
                  <br />
                  über jedes Fach hinweg.
                </>
              }
              description={
                <>
                  Synedrix pflegt einen einzigen, aktiven Wissensgraphen. Dein Mathe-Tutor weiß bereits,
                  wo du in Chemie Probleme hattest, sodass Erklärungen auf deinem tatsächlichen Kenntnisstand aufbauen.
                </>
              }
            />
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.65, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <FeatureList />
          </motion.div>
        </div>

        {/* Right column: Graph view */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="w-full lg:w-fit flex justify-center"
        >
          <GraphView />
        </motion.div>
      </div>
    </Section>
  );
}

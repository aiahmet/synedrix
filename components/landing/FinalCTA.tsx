"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { ArrowRight } from "@/components/landing/icons";

export function FinalCTA() {
  const reduce = useReducedMotion();

  return (
    <section
      aria-labelledby="cta-title"
      className="px-6 py-24 sm:px-10 sm:py-32 md:px-14"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex max-w-3xl flex-col items-center text-center"
      >
        <h2
          id="cta-title"
          className="text-balance text-[clamp(1.875rem,3.4vw+0.5rem,3rem)] font-semibold leading-[1.05] tracking-[-0.024em] text-foreground"
        >
          Öffne ein Thema.
          <br />
          Deine erste Aufgabe für morgen steht schon bereit.
        </h2>

        <p className="mt-6 max-w-xl text-pretty text-[14.5px] leading-[1.55] text-muted-foreground sm:text-[15.5px]">
          Wähle ein beliebiges Thema. Die erste Lerneinheit dauert bei den meisten Nutzern etwa 23 Minuten. 
          Von dort aus analysiert das System den Lernstand, den du hinterlässt &ndash; jeden erfassten Fehler, 
          jede Antwort des Tutors, jede Lernstandsdifferenz &ndash; und plant den nächsten Schritt.
        </p>

        <div className="mt-10 flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
          <Link
            href="/sign-up"
            className="group inline-flex h-10 items-center gap-2 rounded-md bg-accent px-5 text-[13px] font-medium text-accent-foreground shadow-none outline-none transition-colors hover:bg-accent/90"
          >
            Jetzt loslegen
            <ArrowRight
              className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5"
              weight="bold"
            />
          </Link>
          <Link
            href="https://github.com/aiahmet/synedrix"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex h-10 items-center gap-1.5 px-2 text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground"
          >
            Quellcode auf GitHub ansehen
            <ArrowRight className="h-3 w-3" weight="bold" />
          </Link>
        </div>

        <p className="mt-12 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
          Unter MIT-Lizenz. Keine Kreditkarte. Als Einzelbenutzer-System konzipiert.
        </p>
      </motion.div>
    </section>
  );
}

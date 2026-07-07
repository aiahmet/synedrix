"use client";

import Link from "next/link";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  CockpitCard,
  CockpitCardHeader,
} from "@/components/dashboard/CockpitCard";
import {
  ArrowRight,
  Gauge,
  Pulse,
  Sparkle,
  User,
} from "@/components/landing/icons";
import {
  GERMAN_GRADE_LABELS,
  type GermanLetterGrade,
} from "@/lib/ai/prompts/grading";

export default function MyTopicsPage() {
  const me = useQuery(api.users.getMe);
  const owned = useQuery(
    api.topics.listUserTopicsByOwner,
    me && me._id ? { ownerId: me._id as Id<"users"> } : "skip"
  );

  if (me === undefined || owned === undefined) {
    return <Skeleton />;
  }

  if (owned.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          / meine-themen
        </span>
        <h1 className="text-balance text-[clamp(1.5rem,2vw+0.5rem,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          Deine Themen
        </h1>
        <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">
          Jedes der folgenden Themen wurde von dir zusätzlich zum regulären Lehrplan erstellt. Klicke auf ein Thema, um die Lektion zu öffnen, oder gehe auf
          <Link
            href="/subjects"
            className="ml-1 inline-flex items-center gap-1 text-accent transition-colors hover:text-accent/80"
          >
            Fächer durchsuchen <ArrowRight className="h-3 w-3" weight="bold" />
          </Link>{" "}
          um weitere reguläre Fächer zu deinem Cockpit hinzuzufügen.
        </p>
      </header>

      <CockpitCard>
        <CockpitCardHeader
          label="Erstellte Themen"
          trailing={
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              {owned.length} insgesamt
            </span>
          }
        />
        <ul className="flex flex-col divide-y divide-border/60">
          {owned.map((t: (typeof owned)[number]) => {
            const grade = t.latestRun?.grade ?? null;
            const tone = grade
              ? grade === "1" || grade === "2"
                ? "var(--subject-chemistry)"
                : grade === "3"
                  ? "var(--subject-german)"
                  : "var(--subject-french)"
              : "var(--subject-chemistry)";
            return (
              <li
                key={t.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
                      {t.title}
                    </h3>
                    <span
                      className="inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.16em]"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--subject-chemistry) 10%, transparent)",
                        borderColor:
                          "color-mix(in srgb, var(--subject-chemistry) 28%, transparent)",
                        color: "var(--subject-chemistry)",
                      }}
                    >
                      Mein Thema
                    </span>
                    {t.latestLesson && (
                      <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
                        v{t.latestLesson.version} ·{" "}
                        {t.latestLesson.wordCount} Wörter
                      </span>
                    )}
                  </div>
                  {t.objectives.length > 0 && (
                    <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                      {t.objectives[0]}
                      {t.objectives.length > 1 && (
                        <span className="text-muted-foreground/70">
                          {" "}
                          +{t.objectives.length - 1} weitere
                        </span>
                      )}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">
                    {t.latestRun?.status ? (
                      <span className="inline-flex items-center gap-1">
                        <Gauge className="h-3 w-3" weight="duotone" />
                        {t.latestRun.status.replace(/_/g, " ")}
                        {t.latestRun.completedAt ? (
                          <span className="ml-1">· zuletzt geübt</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Sparkle className="h-3 w-3" weight="duotone" />
                        Wartet auf erste Übung
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  {grade ? (
                    <span
                      className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[12px] font-medium tracking-tight"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${tone} 10%, transparent)`,
                        borderColor: `color-mix(in srgb, ${tone} 32%, transparent)`,
                        color: tone,
                      }}
                    >
                      <span className="text-[18px] font-semibold leading-none tracking-[-0.02em]">
                        {grade as GermanLetterGrade}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                        {GERMAN_GRADE_LABELS[grade as GermanLetterGrade].label}
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={`/my-topics/${t.slug}/practice`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-[12px] font-medium text-background transition-colors hover:bg-foreground/90"
                    >
                      <Pulse className="h-3 w-3" weight="duotone" />
                      Übung starten
                    </Link>
                  )}
                  <Link
                    href={`/my-topics/${t.slug}/lesson`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
                  >
                    <ArrowRight className="h-3 w-3" weight="bold" />
                    Lektion öffnen
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </CockpitCard>
    </div>
  );
}

function Skeleton() {
  return (
    <CockpitCard>
      <div className="flex flex-col gap-3 py-4">
        <div className="h-5 w-40 animate-pulse rounded bg-muted/40" />
        <div className="h-3 w-72 animate-pulse rounded bg-muted/30" />
      </div>
    </CockpitCard>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          / meine-themen
        </span>
        <h1 className="text-balance text-[clamp(1.5rem,2vw+0.5rem,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          Deine Themen
        </h1>
      </header>
      <CockpitCard>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--subject-chemistry) 14%, transparent)",
              color: "var(--subject-chemistry)",
            }}
            aria-hidden
          >
            <User className="h-5 w-5" weight="duotone" />
          </span>
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            Noch keine eigenen Themen erstellt
          </h2>
          <p className="max-w-md text-[12.5px] text-muted-foreground">
            Öffne ein beliebiges Kapitel und klicke auf <b>Eigenes Thema hinzufügen</b>, um eine komplette Lektion aus einer kurzen Beschreibung zu generieren. Deine erstellten Themen erscheinen hier und können jederzeit geübt werden.
          </p>
          <Link
            href="/subjects"
            className="mt-1 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            Fächer durchsuchen
            <ArrowRight className="h-3.5 w-3.5" weight="bold" />
          </Link>
        </div>
      </CockpitCard>
    </div>
  );
}

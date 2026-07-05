"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  CheckCircle,
  Compass,
  Sparkle,
  Stack,
  Target,
  Timer,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils/cn";
import { resolveColorVar } from "@/lib/utils/subjectColor";

/**
 * SessionHeader.
 *
 * The top band of /tutor, replacing the old TutorHeader.
 * Reads from `sessionHeader` props which the shell
 * composes from URL + memory snapshot data:
 *
 *   - Breadcrumb chain (subjects / subject / topic)
 *   - Topic / subject title (no longer just chat
 *     history — the title chips into a mastery ring)
 *   - Focus goal pill (read from memory snapshot)
 *   - Estimated minutes remaining pill (read from
 *     memory snapshot)
 *   - Difficulty chip (EASY / MEDIUM / HARD)
 *   - Confidence + mastery combined chip
 *   - End-session CTA (when sessionId !== null)
 *
 * The end-session CTA preserves the reflection panel
 * behavior from the previous TutorHeader: when the
 * user clicks "End session" the panel expands with
 * a tiny reflection textarea and a Confirm button.
 *
 * The elapsed-time ticker is local state so re-renders
 * stay cheap and the visual stays in sync with the
 * sessionStart prop.
 */
export function SessionHeader({
  subject,
  topic,
  subjectColor,
  sessionId,
  threadMessageCount,
  focusGoal,
  mastery,
  confidence,
  estimatedMinutesToMastery,
  difficulty,
  objectiveSummary,
}: {
  readonly subject: { readonly slug: string; readonly title: string };
  readonly topic: { readonly slug: string; readonly title: string } | null;
  readonly subjectColor?: string;
  readonly sessionId: string | null;
  readonly threadMessageCount: number;
  readonly focusGoal: string | null;
  readonly mastery: number;
  readonly confidence: number;
  readonly estimatedMinutesToMastery: number | null;
  readonly difficulty: "EASY" | "MEDIUM" | "HARD" | null;
  readonly objectiveSummary: string | null;
}) {
  const router = useRouter();
  const hasSession = sessionId !== null;
  const [endingPanel, setEndingPanel] = useState(false);
  const [reflection, setReflection] = useState("");
  const [pending, startTransition] = useTransition();
  const endSession = useMutation(api.tutor.endSession);
  // `startedAt` is initialised at mount with the current
  // wall-clock time. The parent shell keys this component
  // on `sessionId` (see `app/(app)/tutor/TutorClient.tsx`),
  // so a session swap remounts the whole header and the
  // `useState` initializer re-runs against the new mount.
  // This is the "render-from-state" pattern the React docs
  // recommend (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  // and it avoids the `react-hooks/set-state-in-effect`
  // lint entirely. The trade-off is a full sub-tree
  // remount on session swap — acceptable because the
  // header is a thin presentational component with no
  // expensive local state.
  const [startedAt] = useState<number>(() => Date.now());
  const now = useNowTicker();
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const fillVar = resolveColorVar(subjectColor);

  const onEnd = () => {
    if (!hasSession) return;
    const actualElapsedSec = Math.max(
      0,
      Math.floor((Date.now() - startedAt) / 1000)
    );
    startTransition(async () => {
      try {
        await endSession({
          sessionId: sessionId as Id<"studySessions">,
          durationSec: actualElapsedSec,
          reflection:
            reflection.trim().length > 0 ? reflection.trim() : undefined,
        });
        const back = topic
          ? `/subjects/${subject.slug}/${topic.slug}`
          : `/subjects/${subject.slug}`;
        router.push(back);
      } catch (err) {
        console.error("Failed to end session:", err);
      }
    });
  };

  return (
    <header className="flex flex-col gap-3.5">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5"
      >
        <Link
          href="/subjects"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated/60 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm transition-colors hover:border-accent-border/60 hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" weight="bold" />
          Subjects
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <Link
          href={`/subjects/${subject.slug}`}
          className="rounded-full px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          {subject.title}
        </Link>
        {topic && (
          <>
            <span className="text-muted-foreground/40">/</span>
            <span
              className="rounded-full px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em]"
              style={{
                backgroundColor: `color-mix(in srgb, ${fillVar} 14%, transparent)`,
                color: fillVar,
              }}
            >
              {topic.title}
            </span>
          </>
        )}
      </nav>

      {/* Title row + mastery ring + end-session CTA */}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-md border"
              style={{
                backgroundColor: `color-mix(in srgb, ${fillVar} 14%, transparent)`,
                borderColor: `color-mix(in srgb, ${fillVar} 30%, transparent)`,
                color: fillVar,
              }}
              aria-hidden
            >
              <Stack className="h-4 w-4" weight="duotone" />
            </span>
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
                Studying
              </p>
              <h1 className="text-balance text-[clamp(1.4rem,1.6vw+0.6rem,1.75rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-foreground">
                {topic ? topic.title : subject.title}
              </h1>
            </div>
          </div>
          {objectiveSummary && (
            <p className="max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
              {objectiveSummary}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3.5">
          <MasteryRing value={mastery} confidence={confidence} />
          {hasSession && !endingPanel && (
            <button
              type="button"
              onClick={() => setEndingPanel(true)}
              disabled={pending}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle className="h-3.5 w-3.5" weight="bold" />
              End session
            </button>
          )}
          {hasSession && endingPanel && (
            <div
              onKeyDown={(e) => {
                if (e.key === "Escape" && !pending) {
                  setEndingPanel(false);
                  setReflection("");
                }
              }}
              className="flex w-full max-w-sm flex-col gap-2 rounded-xl border border-border bg-surface-elevated p-3 sm:w-80"
            >
              <label
                htmlFor="tutor-reflection"
                className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground"
              >
                Quick reflection (optional)
              </label>
              <textarea
                id="tutor-reflection"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={3}
                placeholder="What clicked? What is still fuzzy?"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEndingPanel(false);
                    setReflection("");
                  }}
                  disabled={pending}
                  className="inline-flex h-8 items-center rounded-md px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onEnd}
                  disabled={pending}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-medium text-accent-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkle className="h-3 w-3" weight="duotone" />
                  {pending ? "Ending..." : "Confirm end"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status strip: focus / minutes / difficulty / confidence / thread count */}
      <ul className="flex flex-wrap items-center gap-2">
        <StatusPill
          icon={<Target className="h-3 w-3" weight="duotone" />}
          label="Goal"
          value={focusGoal ?? "Stay current"}
        />
        <StatusPill
          icon={<Timer className="h-3 w-3" weight="duotone" />}
          label="Estimated"
          value={
            estimatedMinutesToMastery !== null
              ? `${estimatedMinutesToMastery}m to mastery`
              : hasSession
                ? `${formatElapsed(elapsed)} in session`
                : "On-demand study"
          }
        />
        {difficulty && (
          <StatusPill
            icon={<Compass className="h-3 w-3" weight="duotone" />}
            label="Difficulty"
            value={DIFFICULTY_LABEL[difficulty]}
            tone={difficulty === "EASY" ? "accent" : difficulty === "MEDIUM" ? "physics" : "french"}
          />
        )}
        <StatusPill
          icon={<Brain className="h-3 w-3" weight="duotone" />}
          label="Confidence"
          value={`${Math.round(confidence * 100)}%`}
          tone="chemistry"
        />
        <li className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          {threadMessageCount}{" "}
          {threadMessageCount === 1 ? "message" : "messages"}
        </li>
      </ul>
    </header>
  );
}

/**
 * StatusPill.
 *
 * Small chip with icon + label + value. Renders the
 * master accent ring around the chip when
 * `tone === "accent"`. Otherwise uses one of the
 * per-subject hues for visual identification.
 */
function StatusPill({
  icon,
  label,
  value,
  tone = "muted",
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string;
  readonly tone?: "muted" | "accent" | "physics" | "chemistry" | "french";
}) {
  const toneVar =
    tone === "muted"
      ? "var(--muted-foreground)"
      : tone === "accent"
        ? "var(--accent)"
        : tone === "physics"
          ? "var(--subject-physics)"
          : tone === "chemistry"
            ? "var(--subject-chemistry)"
            : "var(--subject-french)";
  return (
    <li
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated/60 px-2.5 py-1 text-[11px]"
      )}
      style={{ color: toneVar }}
    >
      <span aria-hidden>{icon}</span>
      <span className="font-mono uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </li>
  );
}

/**
 * MasteryRing.
 *
 * Compact ring at the right of the title. Shows
 * mastery as the fill and confidence as the
 * auxiliary stroke for a single-glance readout.
 */
function MasteryRing({
  value,
  confidence,
}: {
  readonly value: number;
  readonly confidence: number;
}) {
  const SIZE = 56;
  const STROKE = 5;
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const mastery = Math.max(0, Math.min(1, value));
  const offset = circumference * (1 - mastery);
  const conf = Math.max(0, Math.min(1, confidence));
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
      aria-hidden={false}
      aria-label={`Mastery ${Math.round(mastery * 100)} percent, confidence ${Math.round(conf * 100)} percent`}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          stroke="var(--border)"
          strokeWidth={STROKE}
          fill="none"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          stroke="var(--accent)"
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[13px] font-semibold tabular-nums leading-none text-foreground">
          {Math.round(mastery * 100)}
          <span className="text-[8px] text-muted-foreground">%</span>
        </span>
        <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground">
          {Math.round(conf * 100)}% conf
        </span>
      </div>
    </div>
  );
}

const DIFFICULTY_LABEL: Record<"EASY" | "MEDIUM" | "HARD", string> = {
  EASY: "Foundational",
  MEDIUM: "Intermediate",
  HARD: "Advanced",
};

function formatElapsed(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function useNowTicker(): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

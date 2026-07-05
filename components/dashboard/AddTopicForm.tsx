"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { z } from "zod";

import {
  CockpitCard,
  CockpitCardHeader,
} from "@/components/dashboard/CockpitCard";
import {
  CheckCircle,
  Plus,
  Sparkle,
  WarningCircle,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import type { Id } from "@/convex/_generated/dataModel";

// Mirror of the schema the route handler uses. The
// client validates the partial stream against the same
// surface so the live-typing UX faithfully reflects
// what the model is producing.
const lessonSchemaClient = z.object({
  sections: z.array(
    z.object({
      heading: z.string(),
      body: z.string(),
    })
  ),
  glossary: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
    })
  ),
});

type FormMode = "idle" | "submitting" | "done" | "error";

/**
 * AddTopicForm.
 *
 * The chapter-page "+ Add topic" entry point. Per plan
 * §6.2: 3-state button (idle → "Generating…" with a live
 * stream display of section headings as they fill in →
 * done/error). On success, navigates to
 * /my-topics/[topicSlug]/lesson where the slug is derived
 * client-side from the title.
 *
 * Live UX: the form streams the lesson structure via
 * `experimental_useObject` from `@ai-sdk/react` v4. The
 * route handler commits the canonical row server-side;
 * the client just mirrors the partial object into a live
 * section-heading list during the stream.
 */
export function AddTopicForm({
  chapterId,
  subjectTitle,
  subjectSlug,
}: {
  readonly chapterId: Id<"chapters">;
  readonly subjectTitle: string;
  readonly subjectSlug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [objectives, setObjectives] = useState("");
  const [gradeLevel, setGradeLevel] = useState("11");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">(
    "MEDIUM"
  );
  const [depth, setDepth] = useState<"simple" | "standard" | "rigorous">(
    "standard"
  );
  const [mode, setMode] = useState<FormMode>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stream = useObject({
    api: "/api/topics/lesson/stream",
    schema: lessonSchemaClient,
  });

  const submit = () => {
    const t = title.trim();
    const b = brief.trim();
    if (t.length === 0 || b.length === 0) {
      setErrorMsg("Title and brief are required.");
      return;
    }

    setMode("submitting");
    setErrorMsg(null);

    const payload = {
      subjectTitle,
      subjectSlug,
      chapterId,
      title: t,
      brief: b,
      difficulty,
      depth,
      objectives: objectives
        .split(/\r?\n/u)
        .map((s) => s.trim())
        .filter(Boolean),
      gradeLevel: gradeLevel.trim() || undefined,
    };

    void stream.submit(payload);

    void (async () => {
      const startedAt = Date.now();
      // Loop with a guard so a hung stream does not
      // hang the button forever. The route handler
      // commits server-side so even if the client hangs
      // we still wrote a row.
      for (;;) {
        if (!stream.isLoading) break;
        if (Date.now() - startedAt > 120_000) {
          setMode("error");
          setErrorMsg(
            "The lesson is taking longer than expected. You can wait — the lesson is still being generated server-side — or close this form and try Regenerate later."
          );
          return;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      if (stream.error) {
        setMode("error");
        setErrorMsg(stream.error.message ?? "Stream failed.");
        return;
      }
      if (!stream.object) {
        setMode("error");
        setErrorMsg("No lesson object was returned.");
        return;
      }
      setMode("done");
      const optimisticSlug = t
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "topic";
      router.push(`/my-topics/${optimisticSlug}/lesson`);
    })();
  };

  if (!open) {
    return (
      <CockpitCard>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-surface-elevated/40 px-5 py-4 text-left transition-colors hover:border-ring/40 hover:bg-surface-elevated"
        >
          <span className="flex items-center gap-3">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-subtle/60 text-accent"
              aria-hidden
            >
              <Plus className="h-4 w-4" weight="bold" />
            </span>
            <span>
              <span className="block text-[13.5px] font-semibold tracking-tight text-foreground">
                Add your own topic
              </span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">
                Generate a whole-topic lesson + practice from a free-text brief.
              </span>
            </span>
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors group-hover:text-foreground">
            Open form →
          </span>
        </button>
      </CockpitCard>
    );
  }

  const disabled = mode === "submitting";
  const partialSections = (() => {
    const sections = stream.object?.sections ?? [];
    return sections.map((s) => ({
      heading: (s as { heading?: string }).heading ?? "",
      body: (s as { body?: string }).body ?? "",
    }));
  })();

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Add a new topic"
        trailing={
          <Link
            href={`/subjects/${subjectSlug}`}
            className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to subject
          </Link>
        }
      />

      <div className="flex flex-col gap-4">
        <p className="max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
          A short title + brief + a few objectives gives the tutor
          enough to write a 4–8 section lesson. Hit Generate and the
          lesson fills in live below — once it lands, you&apos;ll
          land on the lesson page where you can start a practice
          run.
        </p>

        <Field
          label="Title"
          hint="Short. Kebab-case the slug is derived from this."
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={disabled}
            maxLength={120}
            placeholder="Logarithmen in der Analysis"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <Field
          label="Brief"
          hint="What this topic covers, in 1–3 sentences. The tutor grounds the lesson in this."
        >
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            disabled={disabled}
            rows={3}
            maxLength={2000}
            placeholder="Cover the change-of-base rule and at least one worked example. End with a single worked physics example connecting to decibels."
            className="min-h-[3.5rem] w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Difficulty">
            <Select
              value={difficulty}
              onChange={(v) => setDifficulty(v as typeof difficulty)}
              disabled={disabled}
            >
              <option value="EASY">EASY</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HARD">HARD</option>
            </Select>
          </Field>
          <Field label="Depth">
            <Select
              value={depth}
              onChange={(v) => setDepth(v as typeof depth)}
              disabled={disabled}
            >
              <option value="simple">simple</option>
              <option value="standard">standard</option>
              <option value="rigorous">rigorous</option>
            </Select>
          </Field>
          <Field label="Grade">
            <input
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              disabled={disabled}
              maxLength={4}
              placeholder="11"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[13px] tabular-nums text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
        </div>

        <Field
          label="Objectives (one per line)"
          hint="Optional but recommended. Three short lines from this brief dramatically improve the lesson."
        >
          <textarea
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            disabled={disabled}
            rows={3}
            placeholder="Define log as the inverse of exponential.&#10;Apply the change-of-base rule.&#10;Connect log to decibels in physics."
            className="min-h-[3.5rem] w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {mode === "submitting"
              ? "Streaming lesson live…"
              : mode === "error"
                ? "Generation failed"
                : mode === "done"
                  ? "Lesson committed"
                  : "Ready"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!disabled) {
                  setOpen(false);
                  setMode("idle");
                  setErrorMsg(null);
                }
              }}
              disabled={disabled}
              className="inline-flex h-10 items-center rounded-lg border border-border bg-surface-elevated px-4 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={disabled}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[12.5px] font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
                mode === "submitting"
                  ? "bg-accent text-accent-foreground"
                  : "bg-foreground text-background"
              )}
            >
              {mode === "submitting" ? (
                <>
                  <Sparkle className="h-3.5 w-3.5 animate-pulse" weight="duotone" />
                  Generating…
                </>
              ) : mode === "done" ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5" weight="bold" />
                  Opening lesson →
                </>
              ) : mode === "error" ? (
                <>
                  <WarningCircle className="h-3.5 w-3.5" weight="bold" />
                  Retry
                </>
              ) : (
                <>
                  <Sparkle className="h-3.5 w-3.5" weight="duotone" />
                  Generate lesson
                </>
              )}
            </button>
          </div>
        </div>

        {mode === "submitting" && <StreamingPreview sections={partialSections} />}

        {errorMsg && (
          <p className="rounded-lg border border-subject-french/30 bg-subject-french/10 px-3 py-2 text-[12px] text-subject-french">
            {errorMsg}
          </p>
        )}
      </div>
    </CockpitCard>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-[11.5px] text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

function Select({
  value,
  onChange,
  disabled,
  children,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly disabled?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
    >
      {children}
    </select>
  );
}

function StreamingPreview({
  sections,
}: {
  readonly sections: ReadonlyArray<{ readonly heading: string; readonly body: string }>;
}) {
  if (sections.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-elevated/40 px-3 py-2 text-[12px] text-muted-foreground">
        Lesson sections will appear here as the tutor types them in.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-accent-border/40 bg-accent-subtle/20 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
        Live — {sections.length} section{sections.length === 1 ? "" : "s"} so far
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {sections.map((s, i) => (
          <li
            key={i}
            className="flex items-baseline gap-2 text-[12.5px] text-foreground"
          >
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="font-medium tracking-tight">
              {s.heading || "…"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

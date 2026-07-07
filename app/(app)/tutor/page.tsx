import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ensureSeedBootstrapped } from "@/lib/server/bootstrapSeed";
import { TutorClient } from "./TutorClient";
import { CockpitCard } from "@/components/dashboard/CockpitCard";
import { ArrowLeft, ChatCircleText, ArrowUpRight } from "@/components/landing/icons";

/**
 * /tutor.
 *
 * The AI tutor page. Reads the `subject`, `topic`, `session`,
 * and `q` query params (set by the Start topic / Start study
 * session CTAs and by the AskTutor composer on the topic page),
 * resolves the canonical ids, then delegates to a small client
 * island.
 *
 * `q` is the optional question the topic-page AskTutorCta
 * component pre-fills into the composer — without it the tutor
 * just opens with an empty input.
 *
 * `session` is optional: history navigation lands here with
 * just `?subject=...&topic=...` (no session), and the page
 * loads the thread without an end-session CTA or elapsed timer.
 * Mastery updates only happen when a session is active.
 *
 * **Curriculum bootstrap.** This page calls
 * `ensureSeedBootstrapped()` (see `src/lib/server/bootstrapSeed.ts`)
 * which memoises `api.seed.seedIfEmpty` on `globalThis.__seedInflight`
 * so a populated deployment pays at most one cross-network round-trip
 * per server instance. The bootstrap pattern is shared with
 * `/dashboard`. Without it, a user who navigates directly to
 * `/tutor` (deep link, browser refresh, or a deploy that wiped
 * Convex data) lands on a freshly-empty `subjects` table and
 * renders the empty state — even though `subject` is set in the URL.
 *
 * **Offline fallback.** If the Convex query throws (deployment
 * not reachable, JWT invalid, etc.) the page renders a small
 * honest card with a back-to-subjects link rather than 500-ing
 * the route. The earlier behaviour was to propagate the throw;
 * the new fallback matches the patterns used on
 * `/subjects/[slug]/-chapterSlug` for consistency.
 *
 * Auth-gated at the layout level and re-verified here. The
 * page is the only /tutor route; nested routes are out of
 * scope for the MVP.
 */
export default async function TutorPage({
  searchParams,
}: {
  searchParams: Promise<{
    subject?: string;
    topic?: string;
    session?: string;
    q?: string;
    lesson?: string;
    focusItemId?: string;
    /**
     * Plan §3.3: the referrer path. When the user
     * clicked a "Discuss with tutor" CTA on another
     * page, the page that built the URL appended
     * `?from=<current path>` so the tutor's "Back"
     * link routes back to the right place. Falls
     * through to the breadcrumb chain (topic page
     * or subject page) when missing.
     */
    from?: string;
  }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const {
    subject: subjectSlug,
    topic: topicSlug,
    session: sessionId,
    q: composerQ,
    lesson: lessonRunId,
    focusItemId,
    from: fromPath,
  } = await searchParams;

  // Plan §3.3: validate the `?from=` referrer. We
  // accept only same-origin relative paths so a
  // malicious deep link cannot redirect the user
  // to an external site via the tutor "Back" link.
  // The check rejects absolute URLs, protocol-
  // relative URLs (`//evil.com/...`), and encoded
  // protocol-relative URLs (`%2F%2Fevil.com`).
  const sanitizedFromHref =
    typeof fromPath === "string" &&
    fromPath.startsWith("/") &&
    !fromPath.startsWith("//") &&
    !/^%2[fF]%2[fF]/i.test(fromPath)
      ? fromPath
      : null;

  if (!subjectSlug) {
    return <MissingContext />;
  }

  // Curriculum bootstrap, memoised at the process level by
  // `ensureSeedBootstrapped`. Runs BEFORE the per-page fetchQuery
  // so the canonical subjects list is in place by the time the
  // tutor tries to resolve `subjectSlug`. Best-effort: a failure
  // here just falls through to the (still-present) offline
  // fallback further down — the bootstrap itself does not throw.
  await ensureSeedBootstrapped();

  // Validate the session id (if any) so the tutor UI does not
  // render the "Active session" chrome for a session that
  // belongs to a different user (or has been deleted). The
  // mutation `tutor.endSession` does the same check on the
  // server, so a stale sessionId can never be used to mutate
  // state — this check is purely a UX papercut fix.
  let validatedSessionId: string | null = null;
  if (sessionId) {
    const session = await fetchQuery(
      api.studySessions.getByIdForCurrentUser,
      { sessionId: sessionId as Id<"studySessions"> }
    ).catch(() => null);
    if (session) {
      validatedSessionId = sessionId;
    }
  }

  // Resolve the canonical subject by slug. fetchQuery returns
  // the resolved value (not a Preloaded object) so the page
  // can use it directly. Wrapped in try/catch so a Convex
  // outage surfaces a honest offline card instead of a 500.
  let isConvexConfigured = true;
  let subject: {
    subject: {
      id: Id<"subjects">;
      slug: string;
      title: string;
      color?: string;
    };
  } | null = null;

  try {
    subject = await fetchQuery(api.subjects.getBySlug, {
      slug: subjectSlug,
    });
  } catch (err) {
    console.warn("fetchQuery(api.subjects.getBySlug) failed on /tutor:", err);
    isConvexConfigured = false;
  }

  if (!isConvexConfigured) {
    return <OfflineFallback subjectSlug={subjectSlug} />;
  }
  if (!subject) {
    // URL had a `?subject=…` slug but the canonical
    // `getBySlug` returned null. This is distinct from
    // MissingContext (no slug at all) — the slug was set and
    // failed to resolve. Log it so the next debug session does
    // not have to rediscover which path led here, and render a
    // diagnostic placeholder targeted at this state instead of
    // the generic "Pick a subject" prompt.
    console.warn(
      `[tutor] getBySlug returned null for slug "${subjectSlug}" — canonical subject missing in curriculum.`
    );
    return <SubjectNotFound subjectSlug={subjectSlug} />;
  }

  // If a topic slug is provided, resolve it via a direct
  // (subjectSlug, topicSlug) lookup. One read, no N+1.
  const resolvedTopic = await resolveTopic(subjectSlug, topicSlug);

  // The composer initial text comes from the topic-page AskTutor
  // CTA which URL-encodes the quoted-selection + typed question
  // into `?q=...`. We pass it through verbatim — TutorClient
  // applies it to the MessageInput on first mount.
  const composerInitialText =
    typeof composerQ === "string" && composerQ.trim().length > 0
      ? composerQ
      : null;

  // Lesson context: when the URL carries `?lesson=<runId>`
  // (the results-page CTA), fetch the bundled context so
  // TutorClient can render the banner AND forward the lesson
  // block to the chat system prompt (plan §5.6). When the
  // query returns `null` — run does not exist, is not
  // graded, or does not belong to the caller — we log and
  // continue without `lessonContext` per plan §12.
  const lessonContext = await resolveLessonContext(
    lessonRunId
  );

  return (
    <TutorClient
      subjectId={subject.subject.id as Id<"subjects">}
      topicId={resolvedTopic ? (resolvedTopic.id as Id<"topics">) : null}
      subject={{
        slug: subject.subject.slug,
        title: subject.subject.title,
        ...(subject.subject.color ? { color: subject.subject.color } : {}),
      }}
      topic={
        resolvedTopic
          ? { slug: resolvedTopic.slug, title: resolvedTopic.title }
          : null
      }
      sessionId={validatedSessionId}
      composerInitialText={composerInitialText}
      lessonContext={lessonContext}
      backHref={sanitizedFromHref}
      focusItemId={focusItemId ?? null}
    />
  );
}

/**
 * Resolve the optional `?lesson=<runId>` context. Returns
 * `null` when:
 *   - the param is missing,
 *   - the param is malformed,
 *   - `getContextForLessonRun` returns `null` (run does
 *     not exist, does not belong to the caller, or is
 *     not yet graded).
 *
 * Logs a warning on the latter so the next debug session
 * doesn't rediscover this path from scratch.
 */
async function resolveLessonContext(
  runIdRaw: string | undefined
): Promise<
  | {
      topicTitle: string;
      lessonSummary: string;
      grade: "1" | "2" | "3" | "4" | "5" | "6";
      items: ReadonlyArray<{
        prompt: string;
        userAnswer: string;
        verdict: "correct" | "partially_correct" | "incorrect";
        score: number;
        feedback: string;
        betterAnswer: string;
      }>;
      mistakes: ReadonlyArray<{ type: string; cause: string }>;
    }
  | undefined
> {
  if (!runIdRaw) return undefined;
  try {
    const ctx = await fetchQuery(api.tutorContext.getContextForLessonRun, {
      runId: runIdRaw as Id<"topicLessonPractice">,
    });
    if (!ctx) {
      console.warn(
        `[tutor] ?lesson=${runIdRaw} resolved to null — run missing, not graded, or not owned by caller.`
      );
      return undefined;
    }
    return {
      topicTitle: ctx.topic.title,
      // Canonical-baseline runs do not anchor to a
      // `topicLessons` row (the schema declares
      // `lessonId` optional). We surface the topic
      // title alone in that case so the route
      // handler's tutor grounding still has something
      // useful to put in the system prompt.
      lessonSummary: ctx.lesson?.summary ?? ctx.topic.title,
      grade: ctx.run.grade,
      items: ctx.items,
      mistakes: ctx.mistakes.map((m) => ({ type: m.type, cause: m.cause ?? "" })),
    };
  } catch (err) {
    console.warn("[tutor] ?lesson lookup failed:", err);
    return undefined;
  }
}

/**
 * Topic resolver (extracted so the early returns above stay
 * readable). Tolerates Convex errors by returning null — the
 * caller already has the subject scoped, so a missing topic
 * just renders a subject-only thread.
 */
async function resolveTopic(
  subjectSlug: string,
  topicSlug: string | undefined
): Promise<{ id: string; slug: string; title: string } | null> {
  if (!topicSlug) return null;
  try {
    const found = await fetchQuery(api.subjects.getTopicBySlug, {
      subjectSlug,
      topicSlug,
    });
    if (!found) return null;
    return { id: found.id, slug: found.slug, title: found.title };
  } catch (err) {
    console.warn("fetchQuery(api.subjects.getTopicBySlug) failed on /tutor:", err);
    return null;
  }
}

/**
 * Empty state when the page is hit without a subject context
 * (no `?subject=...`). Renders a small honest card with a
 * link back to /subjects so the user can pick a context.
 *
 * Distinct from `SubjectNotFound` below: that one fires when
 * the URL DID carry a `?subject=…` slug but the canonical
 * `getBySlug` returned null (no row in the curriculum or the
 * deploy never ran its seed). Keep the two forks separate
 * so a misconfigured deploy never masquerades as the
 * "no-context" prompt.
 */
function MissingContext() {
  return (
    <div className="mx-auto max-w-2xl">
      <CockpitCard>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <ChatCircleText
            aria-hidden
            className="h-5 w-5 shrink-0 text-accent"
            weight="duotone"
          />
          <div className="flex flex-col gap-1">
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              Pick a subject to start
            </h2>
            <p className="max-w-sm text-[12.5px] text-muted-foreground">
              The tutor needs a subject (and optionally a topic)
              to load the right context. Open a subject and tap
              Start topic to land here.
            </p>
          </div>
          <Link
            href="/subjects"
            className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:opacity-90"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to subjects
          </Link>
        </div>
      </CockpitCard>
    </div>
  );
}

/**
 * Honest diagnostic when the URL has a `?subject=…` slug but
 * the canonical `getBySlug` returned null. Two common causes
 * — a stale deploy where the seed never ran, or a typo in
 * the slug passed in the URL. The hint copy names both so the
 * user has a clear next action instead of an unhelpful
 * generic prompt.
 */
function SubjectNotFound({
  subjectSlug,
}: {
  readonly subjectSlug: string;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <CockpitCard>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <ChatCircleText
            aria-hidden
            className="h-5 w-5 shrink-0 text-subject-physics"
            weight="duotone"
          />
          <div className="flex flex-col gap-1">
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              No subject matches &ldquo;{subjectSlug}&rdquo;
            </h2>
            <p className="max-w-md text-[12.5px] text-muted-foreground">
              The tutor could not find this slug in the canonical
              curriculum. The most common cause is a fresh
              deployment whose seed never ran — open another
              subject first and the dashboard will bootstrap
              the canonical set, or check the URL for typos.
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/subjects"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-4 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface"
            >
              <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
              Back to subjects
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Open dashboard
              <ArrowUpRight className="h-3.5 w-3.5" weight="bold" />
            </Link>
          </div>
        </div>
      </CockpitCard>
    </div>
  );
}

/**
 * Honest fallback when Convex is unreachable on `/tutor`.
 * Distinct from `MissingContext`: that one fires when the user
 * has no `?subject=` param; this one fires when the
 * deployment is down so the route does not 500.
 */
function OfflineFallback({
  subjectSlug,
}: {
  readonly subjectSlug: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <CockpitCard>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <ChatCircleText
            aria-hidden
            className="h-5 w-5 shrink-0 text-subject-physics"
            weight="duotone"
          />
          <div className="flex flex-col gap-1">
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              Could not load tutor for &ldquo;{subjectSlug}&rdquo;
            </h2>
            <p className="max-w-md text-[12.5px] text-muted-foreground">
              The tutor view needs Convex to load the canonical
              curriculum, your mastery, and the thread history.
              Without Convex the route cannot safely render.
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/subjects"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-4 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface"
            >
              <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
              Back to subjects
            </Link>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              Convex offline. Run{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 text-foreground">
                npx convex dev
              </code>{" "}
              <ArrowUpRight
                className="inline h-2.5 w-2.5 align-text-bottom"
                weight="bold"
              />
            </span>
          </div>
        </div>
      </CockpitCard>
    </div>
  );
}

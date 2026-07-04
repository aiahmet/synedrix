import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { TutorClient } from "./TutorClient";
import { CockpitCard } from "@/components/dashboard/CockpitCard";
import { ArrowLeft, ChatCircleText } from "@/components/landing/icons";
import Link from "next/link";

/**
 * /tutor.
 *
 * The AI tutor page. Reads the `subject`, `topic`, and
 * `session` query params (set by the Start topic / Start
 * study session CTAs), resolves the canonical ids, then
 * delegates to a small client island.
 *
 * `session` is optional: history navigation lands here
 * with just `?subject=...&topic=...` (no session), and the
 * page loads the thread without an end-session CTA or
 * elapsed timer. Mastery updates only happen when a session
 * is active.
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
  }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const {
    subject: subjectSlug,
    topic: topicSlug,
    session: sessionId,
  } = await searchParams;

  if (!subjectSlug) {
    return <MissingContext />;
  }

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
  // can use it directly.
  const subject = await fetchQuery(api.subjects.getBySlug, {
    slug: subjectSlug,
  });
  if (!subject) {
    return <MissingContext />;
  }

  // If a topic slug is provided, resolve it via a direct
  // (subjectSlug, topicSlug) lookup. One read, no N+1.
  let topic: { id: string; slug: string; title: string } | null = null;
  if (topicSlug) {
    const found = await fetchQuery(api.subjects.getTopicBySlug, {
      subjectSlug,
      topicSlug,
    });
    if (found) topic = { id: found.id, slug: found.slug, title: found.title };
  }

  return (
    <TutorClient
      subjectId={subject.subject.id as Id<"subjects">}
      topicId={topic ? (topic.id as Id<"topics">) : null}
      subject={{
        slug: subject.subject.slug,
        title: subject.subject.title,
        ...(subject.subject.color ? { color: subject.subject.color } : {}),
      }}
      topic={topic ? { slug: topic.slug, title: topic.title } : null}
      sessionId={validatedSessionId}
    />
  );
}

/**
 * Empty state when the page is hit without a subject context
 * (no `?subject=...`). Renders a small honest card with a
 * link back to /subjects so the user can pick a context.
 */
function MissingContext() {
  return (
    <div className="mx-auto max-w-2xl">
      <CockpitCard>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--accent) 14%, transparent)",
              color: "var(--accent)",
            }}
            aria-hidden
          >
            <ChatCircleText className="h-5 w-5" weight="duotone" />
          </span>
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
            className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to subjects
          </Link>
        </div>
      </CockpitCard>
    </div>
  );
}

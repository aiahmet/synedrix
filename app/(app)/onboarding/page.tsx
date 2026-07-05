import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { currentUser } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import { ensureSeedBootstrapped } from "@/lib/server/bootstrapSeed";
import { OnboardingClient, type AvailableSubject } from "./OnboardingClient";

/**
 * /onboarding.
 *
 * The single route that hosts the 11-question "teach the
 * AI Tutor how you learn" flow. The page is intentionally
 * a thin server shell:
 *
 *   1. Re-verify the Clerk session (middleware is a
 *      first-pass redirect per AGENTS.md security rule).
 *   2. Bootstrap the canonical curriculum so the subjects
 *      list resolves on first paint.
 *   3. If the user is ALREADY onboarded, redirect to
 *      /dashboard without rendering the flow. This mirrors
 *      the (app)/layout.tsx gate which redirects in the
 *      opposite direction — together they form a perfect
 *      loop break.
 *   4. Resolve the canonical subjects list server-side
 *      and pass it as a static prop to the client island.
 *      The list is canonical curriculum data with no
 *      per-user state, so a `fetchQuery` + prop pattern
 *      is both safer (no client runtime hazards from a
 *      rejected preload) and closer to the user's first
 *      paint (no empty grid flash).
 *
 * Auth is re-verified server-side because the layout-level
 * check is path-branched, and the page itself owns the
 * "already onboarded → /dashboard" redirect.
 */
type ConvexSubjectRow = {
  readonly id: import("@/convex/_generated/dataModel").Id<"subjects">;
  readonly slug: string;
  readonly title: string;
  // `description` mirrors the schema's `v.optional(v.string())`
  // — missing stays `undefined`, present stays `string`. The
  // `toAvailableSubject` mapper below strips this field
  // because the onboarding screens do not render it.
  readonly description?: string;
  readonly color?: string;
  readonly icon?: string;
  readonly enrolled: boolean;
  readonly enrolledAt: number | null;
  readonly chapterCount: number;
  readonly topicCount: number;
};

/**
 * Map a `subjects.list` row into the minimal shape the
 * onboarding screens need. Strips per-user state
 * (`enrolled`, `topicCount`, ...) — the screens only
 * render id/slug/title/color/icon.
 */
function toAvailableSubject(row: ConvexSubjectRow): AvailableSubject {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    ...(row.color !== undefined ? { color: row.color } : {}),
    ...(row.icon !== undefined ? { icon: row.icon } : {}),
  };
}

export default async function OnboardingPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const firstName = user?.firstName ?? "";

  // Bootstrap the canonical curriculum so the subject
  // picker has real data on first paint. The mutation
  // short-circuits on a populated deployment. We use the
  // shared `ensureSeedBootstrapped` helper (not the raw
  // mutation call) so a per-process in-flight promise is
  // memoised — two simultaneous server components in the
  // same Node instance share one Convex round-trip instead
  // of two.
  await ensureSeedBootstrapped();

  // Out-redirect: if the user is already onboarded, leave
  // /onboarding immediately and go to /dashboard. Mirrors
  // the (app)/layout.tsx in-redirect.
  //
  // Two notes on the implementation:
  //
  //  1. **Forward the Clerk JWT.** `fetchQuery` does not
  //     auto-forward auth tokens from server components;
  //     we mint a Clerk JWT against the `convex` template
  //     (the same one `convex/auth.config.ts` validates)
  //     and pass it as the third argument. Without it,
  //     `getOnboardingStatus` returns `{signedIn: false}`
  //     and the user is trapped in onboarding forever.
  //  2. **Move `redirect()` out of the try/catch.**
  //     `next/navigation`'s `redirect` throws an internal
  //     `NEXT_REDIRECT` error that Next.js uses to perform
  //     the redirect. Wrapping `redirect("/dashboard")`
  //     in a plain `try {...} catch {}` silently swallows
  //     that signal — the redirect is lost and the user
  //     re-renders /onboarding on every navigation.
  let signedIn = false;
  let shouldRedirectToDashboard = false;
  try {
    // fetchQuery (not preloadQuery) — we need the resolved
    // value here so we can branch on `.signedIn` /
    // `.onboardingComplete` server-side. preloadQuery returns
    // a Preloaded wrapper meant for hydration, not for direct
    // property reads.
    const token = await getToken({ template: "convex" }).catch(() => null);
    const status = await fetchQuery(
      api.users.getOnboardingStatus,
      {},
      token ? { token } : {}
    );
    signedIn = status.signedIn;
    const onboardingComplete = status.onboardingComplete;
    if (signedIn && onboardingComplete) {
      shouldRedirectToDashboard = true;
    }
  } catch {
    // If Convex cannot read status (offline or transient
    // error), the layout-level gate is the second line of
    // defense; `signedIn` stays false so the AccountSyncingState
    // below fires instead of letting the user reach the save
    // mutation and crash via requireUser().
  }

  if (shouldRedirectToDashboard) {
    redirect("/dashboard");
  }

  // CRITICAL GUARD: Clerk-authed but no Convex `users` row
  // yet (typical when the Clerk → Convex webhook hasn't
  // fired, or in dev where the webhook is unwired). Without
  // this the user fills all 11 questions only to have
  // `api.tutorProfile.save` throw inside requireUser. Render
  // an honest "syncing account" state instead.
  if (!signedIn) {
    return <AccountSyncingState firstName={firstName} />;
  }  // Resolve the canonical subject list before rendering so
  // the Subjects and Weakest screens render their option
  // cards on first paint. If the query fails (Convex outage
  // between the seed bootstrap and the list fetch), surface
  // an honest "loading curriculum" fallback instead of
  // letting the client island render against a null list.
  let initialSubjects: ReadonlyArray<AvailableSubject>;
  try {
    const token = await getToken({ template: "convex" }).catch(() => null);
    const rows = await fetchQuery(
      api.subjects.list,
      {},
      token ? { token } : {}
    );
    initialSubjects = rows.map(toAvailableSubject);
  } catch (err) {
    console.warn("subjects.list (onboarding) failed:", err);
    return <CurriculumUnavailableState firstName={firstName} />;
  }

  return (
    <OnboardingClient
      firstName={firstName}
      initialSubjects={initialSubjects}
    />
  );
}

/**
 * AccountSyncingState.
 *
 * Honest fallback when Clerk auth passed but the Convex
 * `users` row doesn't exist yet. Renders a "syncing account"
 * card so the user understands they should refresh shortly
 * rather than reaching the save mutation and crashing inside
 * `requireUser`.
 */
function AccountSyncingState({ firstName }: { readonly firstName: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-20 text-center">
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-subtle/60 text-accent"
      >
        <span className="block h-3 w-3 animate-pulse rounded-full bg-current" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-balance text-[clamp(1.4rem,2.4vw+0.6rem,1.9rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-foreground">
          {firstName
            ? `Setting up ${firstName}&rsquo;s account…`
            : "Setting up your account…"}
        </h1>
        <p className="max-w-sm text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
          We&rsquo;re syncing your sign-in to your study profile. This
          usually takes a couple of seconds — refresh in a moment
          if it doesn&rsquo;t finish on its own.
        </p>
      </div>
    </div>
  );
}

/**
 * CurriculumUnavailableState.
 *
 * Honest fallback for the rare path where the Clerk
 * session is good, the Convex `users` row exists, but the
 * subject list still failed to fetch. Renders a
 * "loading curriculum" card so the user understands they
 * should refresh shortly — the client island cannot
 * reason about subjects it doesn't have.
 */
function CurriculumUnavailableState({ firstName }: { readonly firstName: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-20 text-center">
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-subtle/60 text-accent"
      >
        <span className="block h-3 w-3 animate-pulse rounded-full bg-current" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-balance text-[clamp(1.4rem,2.4vw+0.6rem,1.9rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-foreground">
          {firstName
            ? `Loading subjects for ${firstName}&hellip;`
            : "Loading subjects&hellip;"}
        </h1>
        <p className="max-w-sm text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
          We couldn&rsquo;t pull the curriculum just now. Refresh
          in a moment, or check your connection — once it
          loads, we&rsquo;ll be back here in one click.
        </p>
      </div>
    </div>
  );
}

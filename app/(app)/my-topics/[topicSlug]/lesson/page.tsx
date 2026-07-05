import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { LessonClient } from "./LessonClient";
import { ensureSeedBootstrapped } from "@/lib/server/bootstrapSeed";

/**
 * /my-topics/[topicSlug]/lesson.
 *
 * Thin server shell. The Clerk JWT does not propagate
 * to server-component `fetchQuery` calls, so ownership
 * resolution moves to the client (`LessonClient`)
 * which calls `api.topics.getOwnedTopicBySlug` via
 * `useQuery`. The shell:
 *
 *   1. Authenticates the user at the layout level.
 *   2. Bootstraps the canonical curriculum so a fresh
 *      Convex deployment still resolves the topic's
 *      `chapterId` (the user lands here from a chapter
 *      that may have only just been seeded).
 *
 * No `preloadQuery` here: a server-component preload of
 * `getOwnedTopicBySlug` would return `null` because
 * `ctx.auth.getUserIdentity()` is empty on the server
 * path. We bootstrap the seed + render `LessonClient`
 * and let Convex reactivity do the ownership check on
 * mount.
 */
export default async function MyTopicLessonPage({
  params,
}: {
  params: Promise<{ topicSlug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { topicSlug } = await params;

  // Per-process memoised seed bootstrap. See
  // `src/lib/server/bootstrapSeed.ts` for the rationale.
  // Non-fatal on a transient Convex outage: the page
  // still renders; the client island's `getOwnedTopicBySlug`
  // call surfaces the no-data state honestly.
  await ensureSeedBootstrapped();

  return <LessonClient topicSlug={topicSlug} />;
}

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { PracticeClient } from "./PracticeClient";
import { ensureSeedBootstrapped } from "@/lib/server/bootstrapSeed";

/**
 * /my-topics/[topicSlug]/practice.
 *
 * Thin server shell that mounts the client island. The
 * client resolves the topic via
 * `api.topics.getOwnedTopicBySlug` (Clerk JWT
 * propagates through the convex client).
 */
export default async function PracticePage({
  params,
}: {
  params: Promise<{ topicSlug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { topicSlug } = await params;

  // Per-process memoised seed bootstrap. See
  // `src/lib/server/bootstrapSeed.ts` for the rationale —
  // the in-flight promise is cached on `globalThis` so two
  // simultaneous server components share one Convex
  // round-trip instead of two. Non-fatal on a transient
  // Convex outage: the page still renders.
  await ensureSeedBootstrapped();

  return <PracticeClient topicSlug={topicSlug} />;
}

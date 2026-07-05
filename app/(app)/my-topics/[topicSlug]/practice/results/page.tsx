import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { ResultsClient } from "./ResultsClient";

/**
 * /my-topics/[topicSlug]/practice/results.
 *
 * Server shell. Reads the most recent graded
 * `topicLessonPractice` for the (owner, lesson) pair and
 * delegates rendering to `ResultsClient`. Auth-gated at
 * the layout level and re-verified here.
 *
 * The page intentionally does NOT take a `runId` URL
 * param — the latest graded run for the (topicSlug,
 * owner) is the only sensible target. Linking from the
 * practice page's "Finish & view results" CTA always
 * lands here with the just-finished run as "latest" so
 * the user sees what they just produced.
 */
export default async function ResultsPage({
  params,
}: {
  params: Promise<{ topicSlug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { topicSlug } = await params;
  return <ResultsClient topicSlug={topicSlug} />;
}

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import type { Id } from "@/convex/_generated/dataModel";

import { api } from "@/convex/_generated/api";

export default async function TutorThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { threadId } = await params;

  let subjectSlug: string | null = null;
  let topicSlug: string | null = null;

  try {
    const raw = await fetchQuery(api.tutorComposer.getThreadById, {
      threadId: threadId as Id<"tutorThreads">,
    });
    if (raw) {
      subjectSlug = raw.subjectSlug ?? null;
      topicSlug = raw.topicSlug ?? null;
    }
  } catch {
    redirect("/tutor");
  }

  if (!subjectSlug) {
    redirect("/tutor");
  }

  const query = new URLSearchParams();
  query.set("subject", subjectSlug);
  if (topicSlug) query.set("topic", topicSlug);

  redirect(`/tutor?${query.toString()}`);
}

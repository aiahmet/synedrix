import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { Preloaded } from "convex/react";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import { SubjectRoadmapClient } from "./SubjectRoadmapClient";
import { ArrowLeft, Books } from "@/components/landing/icons";

export default async function SubjectRoadmapPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { slug } = await params;

  let preloaded: Preloaded<typeof api.subjects.getHub> | null = null;

  try {
    preloaded = await preloadQuery(api.subjects.getHub, { slug });
  } catch {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-[var(--shadow-soft)]">
          <div className="rounded-xl bg-background p-7 text-center sm:p-8">
            <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-subject-physics/15 text-subject-physics" aria-hidden>
              <Books className="h-5 w-5" weight="duotone" />
            </span>
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              Could not load roadmap for &ldquo;{slug}&rdquo;
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
              The roadmap needs Convex. Start the dev server and it will appear.
            </p>
            <Link
              href={`/subjects/${slug}`}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background"
            >
              <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
              Back to subject
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <SubjectRoadmapClient preloaded={preloaded} />;
}

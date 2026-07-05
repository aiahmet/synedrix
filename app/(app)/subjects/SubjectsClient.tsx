"use client";

import { Preloaded, usePreloadedQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { SubjectsGrid } from "@/components/dashboard/SubjectsGrid";

/**
 * SubjectsClient.
 *
 * The only client island on /subjects. Subscribes to the
 * preloaded Convex `subjects.list` query.
 *
 * The catalog is intentionally NOT gated on the Convex `users`
 * row existing — it renders whenever there is a Clerk identity
 * (which `proxy.ts` already guarantees). The first `enroll`
 * mutation lazy-creates the row via `requireUser` in
 * `convex/users.ts`. This means a freshly-signed-up user never
 * sees a "syncing" deadlock in dev where the Clerk webhook is
 * not wired up.
 *
 * Because `useMutation` is also called inside `SubjectCard`,
 * the grid updates instantly when the user enrolls or leaves,
 * with no manual refetch.
 */
export function SubjectsClient({
  preloaded,
}: {
  readonly preloaded: Preloaded<typeof api.subjects.list>;
}) {
  const subjects = usePreloadedQuery(preloaded);
  return <SubjectsGrid subjects={subjects} />;
}

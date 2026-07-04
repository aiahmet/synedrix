"use client";

import { Preloaded, usePreloadedQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { SubjectsGrid } from "@/components/dashboard/SubjectsGrid";

/**
 * SubjectsClient.
 *
 * The only client island on /subjects. Subscribes to the preloaded
 * Convex list query and feeds the data into the SubjectsGrid.
 * Because `useMutation` is also called inside `SubjectCard`, the
 * grid updates instantly when the user enrolls or leaves, with
 * no manual refetch.
 */
export function SubjectsClient({
  preloaded,
}: {
  readonly preloaded: Preloaded<typeof api.subjects.list>;
}) {
  const subjects = usePreloadedQuery(preloaded);
  return <SubjectsGrid subjects={subjects} />;
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// ──────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────

export type EnrichedGoal = {
  readonly id: Id<"goals">;
  readonly title: string;
  readonly type: "daily" | "weekly";
  readonly targetCount: number | null;
  readonly completedCount: number;
  readonly deadline: number | null;
  readonly subjectTitle: string | null;
  readonly subjectColor: string | null;
};

export type EnrichedTemplate = {
  readonly id: Id<"sessionTemplates">;
  readonly title: string;
  readonly description: string | null;
  readonly subjectId: Id<"subjects"> | null;
  readonly subjectTitle: string | null;
  readonly subjectColor: string | null;
  readonly intentionHint: string | null;
  readonly targetMinutes: number | null;
};

// ──────────────────────────────────────────────────
// useGoalsManager
// ──────────────────────────────────────────────────

export function useGoalsManager(initialGoals: EnrichedGoal[]) {
  const [goals, setGoals] = useState<EnrichedGoal[]>(initialGoals);
  const [isCreating, setIsCreating] = useState(false);
  const isMutatingRef = useRef(false);

  // Sync with incoming initial data when no mutation is in flight.
  // This handles the case where Convex's reactive query pushes new data
  // after a mutation completes.
  const prevInitialRef = useRef(initialGoals);
  useEffect(() => {
    if (!isMutatingRef.current && prevInitialRef.current !== initialGoals) {
      setGoals(initialGoals);
      prevInitialRef.current = initialGoals;
    }
  }, [initialGoals]);

  const createGoalMutation = useMutation(api.goals.create);
  const incrementGoalMutation = useMutation(api.goals.increment);
  const removeGoalMutation = useMutation(api.goals.remove);

  const createGoal = async (args: {
    title: string;
    type: "daily" | "weekly";
    targetCount?: number;
  }) => {
    setIsCreating(true);
    isMutatingRef.current = true;

    const optimistic: EnrichedGoal = {
      id: `__opt_${crypto.randomUUID()}` as Id<"goals">,
      title: args.title,
      type: args.type,
      targetCount: args.targetCount ?? null,
      completedCount: 0,
      deadline: null,
      subjectTitle: null,
      subjectColor: null,
    };

    setGoals((prev) => [...prev, optimistic]);

    try {
      await createGoalMutation(args);
    } catch {
      // Rollback: remove the optimistic entry
      setGoals((prev) => prev.filter((g) => g.id !== optimistic.id));
    } finally {
      setIsCreating(false);
      isMutatingRef.current = false;
    }
  };

  const incrementGoal = async (goalId: Id<"goals">) => {
    isMutatingRef.current = true;

    // Optimistic increment
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId ? { ...g, completedCount: g.completedCount + 1 } : g,
      ),
    );

    try {
      await incrementGoalMutation({ goalId });
    } catch {
      // Rollback: decrement
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? { ...g, completedCount: g.completedCount - 1 }
            : g,
        ),
      );
    } finally {
      isMutatingRef.current = false;
    }
  };

  const removeGoal = async (goalId: Id<"goals">) => {
    isMutatingRef.current = true;

    const snapshot = goals;
    setGoals((prev) => prev.filter((g) => g.id !== goalId));

    try {
      await removeGoalMutation({ goalId });
    } catch {
      // Rollback: restore the removed entry
      setGoals(snapshot);
    } finally {
      isMutatingRef.current = false;
    }
  };

  return { goals, createGoal, incrementGoal, removeGoal, isCreating } as const;
}

// ──────────────────────────────────────────────────
// useTemplatesManager
// ──────────────────────────────────────────────────

export function useTemplatesManager(initialTemplates: EnrichedTemplate[]) {
  const [templates, setTemplates] =
    useState<EnrichedTemplate[]>(initialTemplates);
  const [isCreating, setIsCreating] = useState(false);
  const isMutatingRef = useRef(false);

  // Sync with incoming initial data when no mutation is in flight.
  const prevInitialRef = useRef(initialTemplates);
  useEffect(() => {
    if (
      !isMutatingRef.current &&
      prevInitialRef.current !== initialTemplates
    ) {
      setTemplates(initialTemplates);
      prevInitialRef.current = initialTemplates;
    }
  }, [initialTemplates]);

  const createTemplateMutation = useMutation(api.planner.createTemplate);
  const removeTemplateMutation = useMutation(api.planner.removeTemplate);

  const createTemplate = async (args: {
    title: string;
    targetMinutes?: number;
  }) => {
    setIsCreating(true);
    isMutatingRef.current = true;

    const optimistic: EnrichedTemplate = {
      id: `__opt_${crypto.randomUUID()}` as Id<"sessionTemplates">,
      title: args.title,
      targetMinutes: args.targetMinutes ?? null,
      description: null,
      subjectId: null,
      subjectTitle: null,
      subjectColor: null,
      intentionHint: null,
    };

    setTemplates((prev) => [...prev, optimistic]);

    try {
      await createTemplateMutation(args);
    } catch {
      // Rollback: remove the optimistic entry
      setTemplates((prev) => prev.filter((t) => t.id !== optimistic.id));
    } finally {
      setIsCreating(false);
      isMutatingRef.current = false;
    }
  };

  const removeTemplate = async (
    templateId: Id<"sessionTemplates">,
  ) => {
    isMutatingRef.current = true;

    const snapshot = templates;
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));

    try {
      await removeTemplateMutation({ templateId });
    } catch {
      // Rollback: restore the removed entry
      setTemplates(snapshot);
    } finally {
      isMutatingRef.current = false;
    }
  };

  return { templates, createTemplate, removeTemplate, isCreating } as const;
}

"use client";

import { useState } from "react";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CockpitCard } from "@/components/dashboard/CockpitCard";
import { Target, Plus } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";
import { GoalRow } from "./GoalRow";

export function GoalsPanel({
  goals,
}: {
  readonly goals: ReadonlyArray<{
    readonly id: Id<"goals">;
    readonly title: string;
    readonly type: "daily" | "weekly";
    readonly targetCount: number | null;
    readonly completedCount: number;
    readonly deadline: number | null;
    readonly subjectTitle: string | null;
    readonly subjectColor: string | null;
  }>;
}) {
  const createGoal = useMutation(api.goals.create);
  const incrementGoal = useMutation(api.goals.increment);
  const removeGoal = useMutation(api.goals.remove);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"daily" | "weekly">("daily");
  const [newTarget, setNewTarget] = useState("");

  const dailies = goals.filter((g) => g.type === "daily");
  const weeklies = goals.filter((g) => g.type === "weekly");

  return (
    <CockpitCard>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" weight="duotone" />
            <span className="text-[13px] font-semibold text-foreground">Ziele</span>
          </span>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" weight="bold" />
          </button>
        </div>

        {showForm && (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-elevated p-3">
            <input
              type="text"
              placeholder="Titel des Ziels"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
            />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setNewType("daily")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  newType === "daily" ? "bg-accent text-accent-foreground" : "bg-surface text-muted-foreground hover:bg-surface-elevated"
                )}
              >
                Täglich
              </button>
              <button
                type="button"
                onClick={() => setNewType("weekly")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  newType === "weekly" ? "bg-accent text-accent-foreground" : "bg-surface text-muted-foreground hover:bg-surface-elevated"
                )}
              >
                Wöchentlich
              </button>
              <input
                type="number"
                placeholder="Ziel"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                className="ml-auto w-16 rounded-md border border-border bg-background px-2 py-1 text-[12.5px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!newTitle.trim()) return;
                void createGoal({
                  title: newTitle.trim(),
                  type: newType,
                  targetCount: newTarget ? Number(newTarget) : undefined,
                }).then(() => {
                  setShowForm(false);
                  setNewTitle("");
                  setNewTarget("");
                });
              }}
              className="rounded-md bg-foreground px-3 py-1.5 text-[11.5px] font-medium text-background transition-colors hover:opacity-90"
            >
              Ziel hinzufügen
            </button>
          </div>
        )}

        {dailies.length > 0 && (
          <div>
            <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Täglich</span>
            <div className="mt-1 flex flex-col gap-1">
              {dailies.map((g) => (
                <GoalRow key={g.id} goal={g} onIncrement={() => incrementGoal({ goalId: g.id })} onRemove={() => removeGoal({ goalId: g.id })} />
              ))}
            </div>
          </div>
        )}

        {weeklies.length > 0 && (
          <div>
            <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Wöchentlich</span>
            <div className="mt-1 flex flex-col gap-1">
              {weeklies.map((g) => (
                <GoalRow key={g.id} goal={g} onIncrement={() => incrementGoal({ goalId: g.id })} onRemove={() => removeGoal({ goalId: g.id })} />
              ))}
            </div>
          </div>
        )}

        {goals.length === 0 && !showForm && (
          <p className="text-[11.5px] text-muted-foreground">Noch keine Ziele gesetzt. Füge ein tägliches oder wöchentliches Ziel hinzu.</p>
        )}
      </div>
    </CockpitCard>
  );
}

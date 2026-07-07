"use client";

import { useState } from "react";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CockpitCard } from "@/components/dashboard/CockpitCard";
import { Timer, Plus, Trash } from "@phosphor-icons/react/dist/ssr";

export function SessionTemplatesPanel({
  templates,
}: {
  readonly templates: ReadonlyArray<{
    readonly id: Id<"sessionTemplates">;
    readonly title: string;
    readonly description: string | null;
    readonly subjectId: Id<"subjects"> | null;
    readonly subjectTitle: string | null;
    readonly subjectColor: string | null;
    readonly intentionHint: string | null;
    readonly targetMinutes: number | null;
  }>;
}) {
  const createTemplate = useMutation(api.planner.createTemplate);
  const removeTemplate = useMutation(api.planner.removeTemplate);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMinutes, setNewMinutes] = useState("");

  return (
    <CockpitCard>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-accent" weight="duotone" />
            <span className="text-[13px] font-semibold text-foreground">Sitzungsvorlagen</span>
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
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface-elevated p-2">
            <input
              type="text"
              placeholder="Name der Vorlage"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
            />
            <input
              type="number"
              placeholder="Min."
              value={newMinutes}
              onChange={(e) => setNewMinutes(e.target.value)}
              className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (!newTitle.trim()) return;
                void createTemplate({
                  title: newTitle.trim(),
                  targetMinutes: newMinutes ? Number(newMinutes) : undefined,
                }).then(() => {
                  setShowForm(false);
                  setNewTitle("");
                  setNewMinutes("");
                });
              }}
              className="rounded-md bg-foreground px-3 py-1.5 text-[11.5px] font-medium text-background transition-colors hover:opacity-90"
            >
              Hinzufügen
            </button>
          </div>
        )}

        {templates.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2"
              >
                <span className="text-[12px] font-medium text-foreground">{t.title}</span>
                {t.targetMinutes != null && (
                  <span className="rounded-full bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {t.targetMinutes} Min.
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeTemplate({ templateId: t.id })}
                  className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:text-destructive"
                >
                  <Trash className="h-2.5 w-2.5" weight="bold" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11.5px] text-muted-foreground">
            Vorlagen helfen dir, fokussierte Lerneinheiten schneller zu starten. Füge eine hinzu wie &ldquo;30 Min. Mathe-Übung&rdquo;
            oder &ldquo;Französisch Vokabeln wiederholen&rdquo;.
          </p>
        )}
      </div>
    </CockpitCard>
  );
}

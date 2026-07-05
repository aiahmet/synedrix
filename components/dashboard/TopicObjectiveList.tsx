import {
  CockpitCard,
  CockpitCardHeader,
} from "@/components/dashboard/CockpitCard";
import { Check } from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";

/**
 * TopicObjectiveList.
 *
 * Renders the topic's learning objectives as an ordered checklist.
 * An objective does not have a per-objective mastery score in
 * the schema (only one mastery value per topic), so the checklist
 * uses the topic-level mastery as a single proxy: when overall
 * mastery >= 0.6 the whole list flips to "checked".
 *
 * The proxy is honest about what it is — the label
 * "Mastered when topic >= 60%" appears as a small inline
 * disclosure underneath the header so the user is not misled.
 *
 * Server-renderable, no client-side state.
 */
export function TopicObjectiveList({
  objectives,
  mastered,
}: {
  readonly objectives: readonly string[];
  readonly mastered: boolean;
}) {
  if (objectives.length === 0) {
    return (
      <CockpitCard>
        <CockpitCardHeader label="Objectives" />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          No objectives recorded for this topic yet.
        </p>
      </CockpitCard>
    );
  }

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Objectives"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {objectives.length} {objectives.length === 1 ? "objective" : "objectives"}
          </span>
        }
      />
      <ol className="flex flex-col gap-2.5">
        {objectives.map((objective, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5"
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                mastered
                  ? "border-accent bg-accent-subtle text-accent"
                  : "border-border bg-surface text-muted-foreground"
              )}
              aria-hidden
            >
              <Check
                className={cn(
                  "h-3 w-3 transition-opacity",
                  mastered ? "opacity-100" : "opacity-0"
                )}
                weight="bold"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] leading-relaxed text-foreground">
                {objective}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
        Mastered when topic mastery &ge; 60%
      </p>
    </CockpitCard>
  );
}

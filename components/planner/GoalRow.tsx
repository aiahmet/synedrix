import type { Id } from "@/convex/_generated/dataModel";
import { Lightning, Trash } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";

export function GoalRow({
  goal,
  onIncrement,
  onRemove,
}: {
  readonly goal: {
    readonly id: Id<"goals">;
    readonly title: string;
    readonly targetCount: number | null;
    readonly completedCount: number;
    readonly subjectTitle: string | null;
    readonly subjectColor: string | null;
  };
  readonly onIncrement: () => void;
  readonly onRemove: () => void;
}) {
  const target = goal.targetCount ?? 1;
  const pct = Math.min(100, Math.round((goal.completedCount / Math.max(1, target)) * 100));
  const done = goal.completedCount >= target;

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5">
      <button
        type="button"
        onClick={onIncrement}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          done ? "border-accent bg-accent text-accent-foreground" : "border-muted-foreground/40 text-transparent hover:border-accent"
        )}
      >
        {done && <Lightning className="h-2.5 w-2.5" weight="fill" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[12px] font-medium text-foreground">{goal.title}</span>
        <div className="flex items-center gap-1.5">
          <div className="h-1 flex-1 rounded-full bg-muted/40">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {goal.completedCount}/{target}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:text-destructive"
      >
        <Trash className="h-3 w-3" weight="bold" />
      </button>
    </div>
  );
}

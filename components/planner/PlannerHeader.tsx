import { Calendar } from "@phosphor-icons/react/dist/ssr";

export function PlannerHeader({
  stats,
}: {
  readonly stats: {
    readonly totalMinutes: number;
    readonly totalSessions: number;
    readonly streakDays: number;
    readonly goalCompletionRate: number;
  };
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        <Calendar className="h-4 w-4 text-accent" weight="duotone" />
        <h1 className="text-[16px] font-semibold tracking-tight text-foreground">
          Planner
        </h1>
      </div>
      <p className="text-[12.5px] text-muted-foreground">
        Plan sessions, set goals, and track consistency.
      </p>
      <div className="mt-2 flex items-center gap-5">
        <span className="text-[15px] font-semibold tabular-nums text-foreground">
          {stats.totalMinutes}m
          <span className="ml-1 text-[12px] font-normal text-muted-foreground">
            this week · {stats.totalSessions} sessions
          </span>
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-[15px] font-semibold tabular-nums text-foreground">
          {stats.streakDays}d
          <span className="ml-1 text-[12px] font-normal text-muted-foreground">
            streak
          </span>
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-[15px] font-semibold tabular-nums text-foreground">
          {stats.goalCompletionRate}%
          <span className="ml-1 text-[12px] font-normal text-muted-foreground">
            goals done
          </span>
        </span>
      </div>
    </div>
  );
}

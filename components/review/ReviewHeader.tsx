import { RescuePlanButton } from "./RescuePlanButton";

export function ReviewHeader({
  data,
}: {
  readonly data: {
    overdueCount: number;
    dueTodayCount: number;
    weakTopicCount: number;
    hasRescuePlanEligible: boolean;
  };
}) {
  return (
    <header className="flex flex-col gap-3">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
        / review
      </span>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-balance text-[clamp(1.5rem,2vw+0.5rem,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
            Review Center
          </h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {data.overdueCount > 0
              ? `${data.overdueCount} overdue · `
              : ""}
            {data.dueTodayCount} due today · {data.weakTopicCount} weak topics
          </p>
        </div>
        <RescuePlanButton
          hasRescuePlanEligible={data.hasRescuePlanEligible}
        />
      </div>
    </header>
  );
}

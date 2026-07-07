/**
 * Compute the current study streak (consecutive days with at least one session)
 * using Intl.DateTimeFormat for DST-safe date-key generation.
 */
export function computeStreak(
  completedAtTimes: readonly number[],
  nowMs: number,
  options: { readonly timeZone: string }
): number {
  if (completedAtTimes.length === 0) return 0;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: options.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayKey = (ms: number): string => {
    try {
      return formatter.format(new Date(ms));
    } catch {
      const d = new Date(ms);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }
  };
  const dayBefore = (d: string): string => {
    const parts = d.split("-");
    if (parts.length !== 3) return d;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const day = Number(parts[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) {
      return d;
    }
    const probe = Date.UTC(y, m - 1, day - 1, 12, 0, 0);
    return dayKey(probe);
  };

  const today = dayKey(nowMs);
  const days = new Set(completedAtTimes.map(dayKey));

  let cursor = today;
  if (!days.has(cursor)) {
    cursor = dayBefore(cursor);
    if (!days.has(cursor)) return 0;
  }
  let streak = 0;
  for (let i = 0; i < 366; i++) {
    if (days.has(cursor)) {
      streak++;
      cursor = dayBefore(cursor);
    } else {
      break;
    }
  }
  return streak;
}

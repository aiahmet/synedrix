/**
 * formatRelativeDate.
 *
 * Format a timestamp as a short, human relative date. Returns
 * "Today", "Yesterday", "Nd ago", "Nw ago", or a localized
 * short date for older timestamps.
 *
 * Pure function. No runtime dependencies. Uses local time
 * because the user expects "yesterday" to mean their yesterday,
 * not UTC's yesterday.
 */
export function formatRelativeDate(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  const day = 24 * 60 * 60 * 1000;
  if (diff < 0) return "Just now";
  if (diff < day) return "Today";
  if (diff < 2 * day) return "Yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))}w ago`;
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "1 change" / "4 changes" / "0 changes" — never "1 change(s)". */
export function pluralizeChanges(count: number): string {
  return `${count} change${count === 1 ? "" : "s"}`;
}

export const FREQUENCY_LABELS: Record<string, string> = {
  hourly: "Every hour",
  every_6_hours: "Every 6 hours",
  daily: "Daily",
  weekly: "Weekly",
};

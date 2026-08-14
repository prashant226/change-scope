const RUN_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-soft text-muted border-border" },
  running: { label: "Running", className: "bg-blue-50 text-primary border-blue-200" },
  completed: { label: "Completed", className: "bg-green-50 text-low border-green-200" },
  partial: { label: "Partial", className: "bg-amber-50 text-medium border-amber-200" },
  failed: { label: "Failed", className: "bg-red-50 text-high border-red-200" },
};

const MONITOR_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-50 text-low border-green-200" },
  paused: { label: "Paused", className: "bg-soft text-muted border-border" },
};

export function RunStatusBadge({ status }: { status: string }) {
  const style = RUN_STATUS_STYLES[status] || RUN_STATUS_STYLES.queued;
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded border ${style.className}`}>
      {style.label}
    </span>
  );
}

export function MonitorStatusBadge({ status }: { status: string }) {
  const style = MONITOR_STATUS_STYLES[status] || MONITOR_STATUS_STYLES.active;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded border ${style.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "active" ? "bg-low" : "bg-muted"}`} />
      {style.label}
    </span>
  );
}

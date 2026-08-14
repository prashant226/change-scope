import { Check, Circle, Loader2 } from "lucide-react";
import type { AgentLogEntry } from "../types/api";

/**
 * Each stage logs an "in_progress" entry immediately followed by its own
 * "completed" entry — by the time you're looking at a finished run's trail
 * (or even a still-running one, for any step other than the current one),
 * every "in_progress" entry has already been superseded. Only the very last
 * entry of a genuinely live run represents work actually happening right
 * now; everything else should read as done, not spin forever.
 */
function StatusIcon({ status, spinning }: { status: AgentLogEntry["status"]; spinning: boolean }) {
  if (status === "failed") return <Circle className="h-4 w-4 text-high shrink-0" aria-hidden />;
  if (spinning) return <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" aria-hidden />;
  return <Check className="h-4 w-4 text-low shrink-0" aria-hidden />;
}

export function AgentTrail({ logs, live }: { logs: AgentLogEntry[]; live: boolean }) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted">Waiting for the agent to start…</p>;
  }

  return (
    <div className="space-y-3" role="log" aria-live={live ? "polite" : "off"} aria-label="Agent activity trail">
      {logs.map((entry, i) => {
        const isCurrentStep = live && i === logs.length - 1 && entry.status === "in_progress";
        return (
          <div key={entry.sequence} className="flex gap-3">
            <div className="pt-0.5">
              <StatusIcon status={entry.status} spinning={isCurrentStep} />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{entry.action}</p>
              <p className="text-sm text-muted">{entry.reason}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

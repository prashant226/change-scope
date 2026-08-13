import { Check, Circle, Loader2 } from "lucide-react";
import type { AgentLogEntry } from "../types/api";

function StatusIcon({ status }: { status: AgentLogEntry["status"] }) {
  if (status === "completed") return <Check className="h-4 w-4 text-low shrink-0" aria-hidden />;
  if (status === "failed") return <Circle className="h-4 w-4 text-high shrink-0" aria-hidden />;
  return <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" aria-hidden />;
}

export function AgentTrail({ logs, live }: { logs: AgentLogEntry[]; live: boolean }) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted">Waiting for the agent to start…</p>;
  }

  return (
    <div className="space-y-3" role="log" aria-live={live ? "polite" : "off"} aria-label="Agent activity trail">
      {logs.map((entry) => (
        <div key={entry.sequence} className="flex gap-3">
          <div className="pt-0.5">
            <StatusIcon status={entry.status} />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">{entry.action}</p>
            <p className="text-sm text-muted">{entry.reason}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

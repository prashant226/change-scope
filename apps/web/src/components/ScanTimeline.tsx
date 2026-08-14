import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import type { RunWithPreview } from "../types/api";

const DOT_COLOR: Record<string, string> = {
  baseline: "bg-primary",
  "no-change": "bg-low",
  high: "bg-high",
  medium: "bg-medium",
  low: "bg-low",
  failed: "bg-medium",
};

function dotClass(run: RunWithPreview): string {
  if (run.status === "failed") return DOT_COLOR.failed;
  if (run.reportType === "baseline") return DOT_COLOR.baseline;
  if (run.meaningfulChangeCount === 0) return DOT_COLOR["no-change"];
  return DOT_COLOR[run.topSignificance || "medium"];
}

function scanTypeLabel(run: RunWithPreview): string {
  return run.reportType === "baseline" ? "Baseline scan" : "Comparison scan";
}

function formatCardTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short" }) +
    " · " +
    new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function ScanTimeline({ runs, onSelectRun }: { runs: RunWithPreview[]; onSelectRun: (runId: string) => void }) {
  if (runs.length === 0) {
    return null; // caller renders the empty state — keeps this component focused on the list itself
  }

  return (
    <ol className="relative border-l border-border ml-1.5">
      {runs.map((run) => {
        const time = run.completedAt || run.startedAt;
        const failed = run.status === "failed";
        const noChange = !failed && run.reportType === "comparison" && run.meaningfulChangeCount === 0;
        const baseline = !failed && run.reportType === "baseline";

        return (
          <li key={run.id} className="mb-3 ml-4">
            <span className={`absolute -left-[5px] mt-2 h-2.5 w-2.5 rounded-full ${dotClass(run)}`} />
            <button
              onClick={() => onSelectRun(run.id)}
              className="w-full text-left rounded-lg border border-border bg-white px-4 py-3 transition-colors hover:border-primary/30 hover:bg-soft/60 group"
            >
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-sm font-medium text-ink">{formatCardTime(time)}</span>
                <span className="text-xs text-muted flex items-center gap-1.5">
                  {scanTypeLabel(run)}
                  {!failed && (
                    <>
                      <span className="text-border">·</span>
                      {run.triggerType === "scheduled" ? "Scheduled" : "Manual"}
                    </>
                  )}
                </span>
              </div>

              {failed && (
                <div className="flex items-start gap-1.5 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-medium shrink-0 mt-0.5" strokeWidth={2} />
                  <div>
                    <p className="text-sm font-medium text-ink">Scan failed</p>
                    <p className="text-xs text-muted">Page could not be captured</p>
                  </div>
                </div>
              )}

              {baseline && (
                <div className="flex items-start gap-1.5 mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-low shrink-0 mt-0.5" strokeWidth={2} />
                  <div>
                    <p className="text-sm font-medium text-ink">Initial snapshot created</p>
                    <p className="text-xs text-muted">Page captured successfully</p>
                  </div>
                </div>
              )}

              {noChange && (
                <div className="flex items-start gap-1.5 mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-low shrink-0 mt-0.5" strokeWidth={2} />
                  <div>
                    <p className="text-sm font-medium text-ink">No meaningful changes</p>
                    <p className="text-xs text-muted">Page materially unchanged since previous scan</p>
                  </div>
                </div>
              )}

              {!failed && !baseline && !noChange && (
                <div className="mb-1">
                  <p className="text-sm font-medium text-ink mb-0.5">
                    {pluralize(run.meaningfulChangeCount, "meaningful change")}
                  </p>
                  {run.topChanges.map((line, i) => (
                    <p key={i} className="text-xs text-muted truncate">{line}</p>
                  ))}
                </div>
              )}

              <div className="flex justify-end mt-1">
                <span className="flex items-center gap-1 text-xs font-medium text-primary">
                  {failed ? "View details" : "View report"}
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

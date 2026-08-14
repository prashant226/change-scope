import type { SnapshotSummary, RunRecord } from "../types/api";
import { formatDateTime } from "../lib/format";

export function SnapshotTimeline({ snapshots, runs }: { snapshots: SnapshotSummary[]; runs: RunRecord[] }) {
  const runsById = new Map(runs.map((r) => [r.id, r]));

  if (snapshots.length === 0) {
    return <p className="text-sm text-muted">No snapshots yet — run this monitor to capture a baseline.</p>;
  }

  return (
    <ol className="relative border-l border-border ml-2">
      {snapshots.map((s) => {
        const run = runsById.get(s.runId);
        const isBaseline = s.versionNumber === 1;
        return (
          <li key={s.id} className="mb-6 ml-4">
            <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
            <p className="text-xs text-muted mb-0.5">{formatDateTime(s.capturedAt)}</p>
            <p className="text-sm font-medium text-ink">Snapshot #{s.versionNumber}</p>
            <p className="text-sm text-muted">
              {isBaseline
                ? "Baseline created"
                : run
                  ? `${run.meaningfulChangeCount} meaningful change(s)`
                  : "Comparison run"}
            </p>
            {!s.isSuccessful && <p className="text-xs text-high mt-1">Capture failed — not used as a baseline.</p>}
          </li>
        );
      })}
    </ol>
  );
}

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { MonitorRecord, RunRecord, SnapshotSummary } from "../types/api";
import { SnapshotTimeline } from "../components/SnapshotTimeline";

export function History() {
  const [monitors, setMonitors] = useState<MonitorRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);

  useEffect(() => {
    api.listMonitors().then((r) => {
      setMonitors(r.monitors);
      if (r.monitors.length > 0) setSelectedId(r.monitors[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.getHistory(selectedId).then((r) => {
      setSnapshots(r.snapshots);
      setRuns(r.runs);
    });
  }, [selectedId]);

  return (
    <div className="max-w-3xl mx-auto py-10 px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">History</h1>
        <p className="text-muted mt-1">How has a webpage changed over time?</p>
      </header>

      {monitors.length === 0 ? (
        <p className="text-sm text-muted">No monitors yet — add one from the Monitors page to see its history.</p>
      ) : (
        <>
          <label className="block text-xs font-medium text-muted mb-1" htmlFor="monitor-picker">
            Monitor
          </label>
          <select
            id="monitor-picker"
            className="w-full max-w-sm rounded-md border border-border px-3 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-primary"
            value={selectedId || ""}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {monitors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title || m.url}
              </option>
            ))}
          </select>

          <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
            <SnapshotTimeline snapshots={snapshots} runs={runs} />
          </div>
        </>
      )}
    </div>
  );
}

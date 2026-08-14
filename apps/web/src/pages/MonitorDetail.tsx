import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { MonitorRecord, RunRecord, SnapshotSummary, AnalyzedChange } from "../types/api";
import { api } from "../lib/api";
import { useRun } from "../hooks/useRun";
import { AgentTrail } from "../components/AgentTrail";
import { ChangeCard } from "../components/ChangeCard";
import { SnapshotTimeline } from "../components/SnapshotTimeline";
import { MonitorStatusBadge } from "../components/StatusBadge";
import { relativeTime, FREQUENCY_LABELS } from "../lib/format";
import { ChevronDown, ChevronRight } from "lucide-react";

type Tab = "changes" | "history" | "trail" | "settings";

const FREQUENCIES = [
  { value: "hourly", label: "Every hour" },
  { value: "every_6_hours", label: "Every 6 hours" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

export function MonitorDetail() {
  const { id } = useParams<{ id: string }>();
  const [monitor, setMonitor] = useState<MonitorRecord | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [latestChanges, setLatestChanges] = useState<{ meaningful: AnalyzedChange[]; cosmetic: AnalyzedChange[] } | null>(null);
  const [latestLogs, setLatestLogs] = useState<Awaited<ReturnType<typeof api.getLogs>>["logs"]>([]);
  const [tab, setTab] = useState<Tab>("changes");
  const [showCosmetic, setShowCosmetic] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const { run: liveRun, logs: liveLogs, changes: liveChanges } = useRun(activeRunId);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ monitor: m }, { snapshots: s, runs: r }] = await Promise.all([api.getMonitor(id), api.getHistory(id)]);
    setMonitor(m);
    setSnapshots(s);
    setRuns(r);
    const latest = r.find((run) => run.status === "completed" || run.status === "partial");
    if (latest) {
      const [changes, { logs }] = await Promise.all([api.getChanges(latest.id), api.getLogs(latest.id)]);
      setLatestChanges(changes);
      setLatestLogs(logs);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // When a live run started from this page finishes, refresh everything from the server.
  useEffect(() => {
    if (liveRun && (liveRun.status === "completed" || liveRun.status === "partial" || liveRun.status === "failed")) {
      load();
    }
  }, [liveRun?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRunNow() {
    if (!id) return;
    const { runId } = await api.runMonitor(id);
    setActiveRunId(runId);
  }

  async function togglePause() {
    if (!id || !monitor) return;
    const nextStatus = monitor.status === "active" ? "paused" : "active";
    const { monitor: updated } = await api.updateMonitor(id, { status: nextStatus });
    setMonitor(updated);
  }

  async function changeFrequency(frequency: string) {
    if (!id) return;
    const { monitor: updated } = await api.updateMonitor(id, { scheduleFrequency: frequency as MonitorRecord["scheduleFrequency"] });
    setMonitor(updated);
  }

  if (!monitor) return <div className="max-w-4xl mx-auto py-10 px-6 text-muted">Loading…</div>;

  const isRunning = liveRun && !["completed", "partial", "failed"].includes(liveRun.status);
  const displayChanges = liveChanges || latestChanges;
  const displayLogs = activeRunId ? liveLogs : latestLogs;

  return (
    <div className="max-w-4xl mx-auto py-10 px-6">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-semibold text-ink">{monitor.title || monitor.url}</h1>
          <MonitorStatusBadge status={monitor.status} />
        </div>
        <p className="text-sm text-muted mb-3">{monitor.url}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted mb-4">
          <span>Last checked: {relativeTime(monitor.lastRunAt)}</span>
          <span>Frequency: {FREQUENCY_LABELS[monitor.scheduleFrequency] || monitor.scheduleFrequency}</span>
          <span>Snapshots: {snapshots.length}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRunNow}
            disabled={Boolean(isRunning)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isRunning ? "Running…" : "Run now"}
          </button>
          <button
            onClick={togglePause}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-soft"
          >
            {monitor.status === "active" ? "Pause" : "Resume"}
          </button>
        </div>
      </header>

      <div className="flex gap-1 border-b border-border mb-6">
        {(["changes", "history", "trail", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t === "trail" ? "Agent Trail" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "changes" && (
        <section>
          {isRunning && (
            <div className="rounded-lg border border-border bg-white p-5 shadow-sm mb-6">
              <h2 className="text-sm font-semibold text-ink mb-4">Agent is running…</h2>
              <AgentTrail logs={liveLogs} live />
            </div>
          )}
          {!displayChanges && !isRunning && (
            <p className="text-sm text-muted">No comparison available yet. Run this monitor again to see a report.</p>
          )}
          {displayChanges && displayChanges.meaningful.length === 0 && !isRunning && (
            <div className="rounded-lg border border-border bg-white p-5 shadow-sm mb-4">
              <h2 className="text-base font-semibold text-ink mb-1">✓ No meaningful changes detected</h2>
              <p className="text-sm text-muted">This page is materially unchanged since the last successful snapshot.</p>
            </div>
          )}
          {displayChanges && displayChanges.meaningful.length > 0 && (
            <div className="space-y-4 mb-6">
              {displayChanges.meaningful.map((c) => (
                <ChangeCard key={c.groupKey} change={c} />
              ))}
            </div>
          )}
          {displayChanges && displayChanges.cosmetic.length > 0 && (
            <div>
              <button
                onClick={() => setShowCosmetic((v) => !v)}
                className="flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
              >
                {showCosmetic ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Other detected changes ({displayChanges.cosmetic.length})
              </button>
              {showCosmetic && (
                <div className="mt-3 space-y-3">
                  {displayChanges.cosmetic.map((c) => (
                    <div key={c.groupKey} className="rounded-md border border-border p-3 text-sm">
                      <p className="text-ink">
                        {c.elementLabel || c.groupTitle}: {c.beforeValue} → {c.afterValue}
                      </p>
                      <p className="text-muted text-xs mt-1">Classification: {c.classification}. {c.whyItMatters}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {tab === "history" && <SnapshotTimeline snapshots={snapshots} runs={runs} />}

      {tab === "trail" && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
          {displayLogs.length === 0 ? (
            <p className="text-sm text-muted">No agent activity recorded yet.</p>
          ) : (
            <AgentTrail logs={displayLogs} live={Boolean(isRunning)} />
          )}
        </section>
      )}

      {tab === "settings" && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-sm max-w-md">
          <label className="block text-xs font-medium text-muted mb-1" htmlFor="frequency">
            Check frequency
          </label>
          <select
            id="frequency"
            className="w-full rounded-md border border-border px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
            value={monitor.scheduleFrequency}
            onChange={(e) => changeFrequency(e.target.value)}
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted mb-4">
            Note: the scheduler isn't running yet in this build — scheduled checks aren't triggered
            automatically. Use "Run now" to check manually.
          </p>
          <button
            onClick={togglePause}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-soft"
          >
            {monitor.status === "active" ? "Pause monitor" : "Resume monitor"}
          </button>
        </section>
      )}
    </div>
  );
}

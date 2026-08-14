import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../lib/api";
import type { MonitorRecord } from "../types/api";
import { MonitorStatusBadge, RunStatusBadge } from "../components/StatusBadge";
import { relativeTime, FREQUENCY_LABELS } from "../lib/format";
import { CreateMonitorModal } from "../components/CreateMonitorModal";

export function Monitors() {
  const [monitors, setMonitors] = useState<MonitorRecord[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    api.listMonitors().then((r) => setMonitors(r.monitors));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRunNow(id: string) {
    setRunningId(id);
    setRunError(null);
    try {
      await api.runMonitor(id);
      navigate(`/monitors/${id}`);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Could not start the run.");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-6">
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Monitors</h1>
          <p className="text-muted mt-1">What webpages are you monitoring?</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Monitor URL
        </button>
      </header>

      {runError && <p className="text-sm text-high mb-3">{runError}</p>}

      <div className="rounded-lg border border-border bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Page</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last run</th>
              <th className="px-4 py-3 font-medium">Changes</th>
              <th className="px-4 py-3 font-medium">Frequency</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {monitors?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No monitors yet. Click "Monitor URL" to add your first webpage.
                </td>
              </tr>
            )}
            {monitors?.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0 hover:bg-soft">
                <td className="px-4 py-3">
                  <button onClick={() => navigate(`/monitors/${m.id}`)} className="text-left">
                    <div className="font-medium text-ink">{m.title || m.url}</div>
                    <div className="text-xs text-muted truncate max-w-xs">{m.url}</div>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1 items-start">
                    <MonitorStatusBadge status={m.status} />
                    {m.latestRunStatus && <RunStatusBadge status={m.latestRunStatus} />}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink">{relativeTime(m.latestRunCompletedAt || m.lastRunAt)}</td>
                <td className="px-4 py-3 text-ink">
                  {m.latestMeaningfulChangeCount !== undefined ? `${m.latestMeaningfulChangeCount} change(s)` : "—"}
                </td>
                <td className="px-4 py-3 text-muted">{FREQUENCY_LABELS[m.scheduleFrequency] || m.scheduleFrequency}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => navigate(`/monitors/${m.id}`)}
                    className="text-sm font-medium text-primary hover:underline mr-3"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleRunNow(m.id)}
                    disabled={runningId === m.id}
                    className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    {runningId === m.id ? "Starting…" : "Run now"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateMonitorModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

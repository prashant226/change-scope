import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History as HistoryIcon, Plus } from "lucide-react";
import { api } from "../lib/api";
import type { MonitorRecord, RunWithPreview } from "../types/api";
import { ScanTimeline } from "../components/ScanTimeline";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { MonitorActionsMenu } from "../components/MonitorActionsMenu";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Toast } from "../components/Toast";

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function History() {
  const navigate = useNavigate();
  const [monitors, setMonitors] = useState<MonitorRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunWithPreview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    api.listMonitors().then((r) => {
      setMonitors(r.monitors);
      if (r.monitors.length > 0) setSelectedId(r.monitors[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setRuns([]);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    api.getHistory(selectedId).then((r) => {
      setRuns(r.runs);
      setLoaded(true);
    });
  }, [selectedId]);

  const selectedMonitor = monitors.find((m) => m.id === selectedId);
  const selectedIsRunning = selectedMonitor?.derivedStatus === "running";

  async function handleDeleteMonitor() {
    if (!selectedId) return;
    try {
      await api.deleteMonitor(selectedId);
    } catch {
      throw new Error("Couldn't delete this monitor. Please try again.");
    }

    // Only touch UI state once the backend has actually confirmed the
    // delete — never optimistically hide it first (§17).
    const remaining = monitors.filter((m) => m.id !== selectedId);
    setMonitors(remaining);
    setShowDeleteConfirm(false);
    setToastMessage("Monitor deleted");
    setSelectedId(remaining.length > 0 ? remaining[0].id : null);
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-6">
      <PageHeader title="History" subtitle="How has a webpage changed over time?" />

      {monitors.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={HistoryIcon}
            title="No monitors yet"
            description="Add a webpage to start tracking changes."
            action={
              <button onClick={() => navigate("/monitors")} className="btn-primary flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                Monitor URL
              </button>
            }
          />
        </div>
      ) : (
        <>
          <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="monitor-picker">
            Monitor
          </label>
          <div className="flex flex-col sm:flex-row sm:items-start gap-2 max-w-lg">
            <div className="flex-1 min-w-0">
              <select
                id="monitor-picker"
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                value={selectedId || ""}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {monitors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title || hostname(m.url)}
                  </option>
                ))}
              </select>
            </div>
            {selectedMonitor && (
              <MonitorActionsMenu
                onOpenMonitor={() => navigate(`/monitors/${selectedMonitor.id}`)}
                onDeleteMonitor={() => setShowDeleteConfirm(true)}
              />
            )}
          </div>
          {selectedMonitor && <p className="text-xs text-muted mt-1 mb-6">{hostname(selectedMonitor.url)}</p>}

          <div className="card p-5">
            <h2 className="text-[15px] font-semibold text-ink">Recent scans</h2>
            <p className="text-xs text-muted mb-4">Select a scan to view its report.</p>

            {!loaded ? (
              <p className="text-sm text-muted py-6 text-center">Loading…</p>
            ) : runs.length === 0 ? (
              <EmptyState
                icon={HistoryIcon}
                title="No scans yet"
                description="Run your first scan to create a baseline and start tracking changes."
                action={
                  <button onClick={() => selectedId && navigate(`/monitors/${selectedId}`)} className="btn-primary">
                    Run now
                  </button>
                }
              />
            ) : (
              <ScanTimeline
                runs={runs}
                onSelectRun={(runId) => selectedId && navigate(`/monitors/${selectedId}?run=${runId}`)}
              />
            )}
          </div>
        </>
      )}

      {showDeleteConfirm && selectedMonitor && (
        <ConfirmDialog
          title={`Delete ${selectedMonitor.title || hostname(selectedMonitor.url)}?`}
          subtitle={selectedMonitor.url}
          description={
            (selectedIsRunning ? "This monitor is currently running a scan.\n\n" : "") +
            "This will permanently delete this monitor, its snapshots, run history, change reports, and Agent Activity.\n\nThis action cannot be undone."
          }
          confirmLabel={selectedIsRunning ? "Stop scan & delete" : "Delete monitor"}
          onConfirm={handleDeleteMonitor}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}

      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
    </div>
  );
}

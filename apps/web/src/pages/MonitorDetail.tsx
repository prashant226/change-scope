import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import type { MonitorRecord, RunRecord, SnapshotSummary, AnalyzedChange } from "../types/api";
import { api } from "../lib/api";
import { useRun } from "../hooks/useRun";
import { AgentActivity } from "../components/AgentActivity";
import { ChangeCard } from "../components/ChangeCard";
import { ReportSummary } from "../components/ReportSummary";
import { BaselineReport } from "../components/BaselineReport";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { groupByKey } from "../lib/groupChanges";
import { SnapshotTimeline } from "../components/SnapshotTimeline";
import { MonitorStatusBadge } from "../components/StatusBadge";
import { relativeTime, formatDateTime, FREQUENCY_LABELS } from "../lib/format";
import { downloadReportPdf } from "../lib/downloadPdf";
import { ChevronDown, ChevronRight, Download, Trash2 } from "lucide-react";

type Tab = "changes" | "history" | "settings";
type Changes = { meaningful: AnalyzedChange[]; cosmetic: AnalyzedChange[] };

function monitorHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const FREQUENCIES = [
  { value: "hourly", label: "Every hour" },
  { value: "every_6_hours", label: "Every 6 hours" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

export function MonitorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewingRunId = searchParams.get("run");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [monitor, setMonitor] = useState<MonitorRecord | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);

  // The run currently shown in the Changes/Activity tabs — either a
  // specific one picked from History, or (by default) the latest finished run.
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [selectedChanges, setSelectedChanges] = useState<Changes | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<Awaited<ReturnType<typeof api.getLogs>>["logs"]>([]);

  const [tab, setTab] = useState<Tab>("changes");
  const [showCosmetic, setShowCosmetic] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Scheduler form state (Settings tab) — separate from monitor.schedulingEnabled
  // until "Save schedule" is pressed, so toggling the switch doesn't fire a
  // request per click.
  const [schedulingDraft, setSchedulingDraft] = useState(false);
  const [frequencyDraft, setFrequencyDraft] = useState("every_6_hours");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const { run: liveRun, logs: liveLogs, changes: liveChanges } = useRun(activeRunId);

  const loadSelectedRun = useCallback(async (runId: string) => {
    const [{ run }, changes, { logs }] = await Promise.all([
      api.getRun(runId),
      api.getChanges(runId),
      api.getLogs(runId),
    ]);
    setSelectedRun(run);
    setSelectedChanges(changes);
    setSelectedLogs(logs);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ monitor: m }, { snapshots: s, runs: r }] = await Promise.all([api.getMonitor(id), api.getHistory(id)]);
    setMonitor(m);
    setSnapshots(s);
    setRuns(r);
    setSchedulingDraft(m.schedulingEnabled);
    setFrequencyDraft(m.scheduleFrequency);

    const targetRunId = viewingRunId || r.find((run) => run.status === "completed" || run.status === "partial" || run.status === "failed")?.id;
    if (targetRunId) await loadSelectedRun(targetRunId);
  }, [id, viewingRunId, loadSelectedRun]);

  useEffect(() => {
    load();
  }, [load]);

  // When a live run started from this page finishes, refresh and switch to viewing it.
  useEffect(() => {
    if (liveRun && (liveRun.status === "completed" || liveRun.status === "partial" || liveRun.status === "failed")) {
      setSearchParams(activeRunId ? { run: activeRunId } : {}, { replace: true });
      load();
    }
  }, [liveRun?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRunNow() {
    if (!id) return;
    const { runId } = await api.runMonitor(id);
    setActiveRunId(runId);
    setTab("changes");
  }

  function handleSelectRun(runId: string) {
    setActiveRunId(null);
    setSearchParams({ run: runId });
    setTab("changes");
  }

  async function handleSaveSchedule() {
    if (!id) return;
    setSavingSchedule(true);
    try {
      const { monitor: updated } = await api.updateMonitor(
        id,
        schedulingDraft ? { schedulingEnabled: true, scheduleFrequency: frequencyDraft as MonitorRecord["scheduleFrequency"] } : { schedulingEnabled: false },
      );
      setMonitor(updated);
    } finally {
      setSavingSchedule(false);
    }
  }

  // One-click shortcut for "turn scheduling off right now" — same effect as
  // unchecking the box and hitting Save schedule, without the extra step.
  async function handlePauseNow() {
    if (!id) return;
    setSavingSchedule(true);
    try {
      const { monitor: updated } = await api.updateMonitor(id, { schedulingEnabled: false });
      setMonitor(updated);
      setSchedulingDraft(false);
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleDownloadPdf(runId: string) {
    setDownloadingPdf(true);
    try {
      await downloadReportPdf(runId, monitor?.title || monitor?.url);
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleDeleteMonitor() {
    if (!id) return;
    await api.deleteMonitor(id);
    navigate("/monitors", { replace: true });
  }

  if (!monitor) return <div className="max-w-4xl mx-auto py-10 px-6 text-muted">Loading…</div>;

  const isRunning = liveRun && !["completed", "partial", "failed"].includes(liveRun.status);
  const displayRun = activeRunId ? liveRun : selectedRun;
  const displayChanges = activeRunId ? liveChanges : selectedChanges;
  const displayLogs = activeRunId ? liveLogs : selectedLogs;
  const isBaseline = displayRun && displayRun.status !== "failed" && displayRun.reportType === "baseline";
  const isComparison = displayRun && displayRun.status !== "failed" && displayRun.reportType === "comparison";
  const derivedStatus = isRunning ? "running" : monitor.derivedStatus || "pending";
  const scheduleDirty = schedulingDraft !== monitor.schedulingEnabled || (schedulingDraft && frequencyDraft !== monitor.scheduleFrequency);

  return (
    <div className="max-w-4xl mx-auto py-10 px-6">
      <header className="mb-7">
        <div className="flex items-center gap-2.5 mb-1.5">
          <h1 className="text-[22px] font-semibold text-ink tracking-tight">{monitor.title || monitor.url}</h1>
          <MonitorStatusBadge status={derivedStatus} />
        </div>
        <p className="text-sm text-muted mb-4">{monitor.url}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted mb-5">
          <span>Last checked: {relativeTime(monitor.lastRunAt)}</span>
          <span>Next check: {monitor.schedulingEnabled ? formatDateTime(monitor.nextRunAt) : "Not scheduled"}</span>
          <span>Frequency: {monitor.schedulingEnabled ? FREQUENCY_LABELS[monitor.scheduleFrequency] || monitor.scheduleFrequency : "Manual only"}</span>
          <span>Snapshots: {snapshots.length}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRunNow} disabled={Boolean(isRunning)} className="btn-primary">
            {isRunning ? "Running…" : "Run now"}
          </button>
        </div>
      </header>

      <div className="flex gap-1 border-b border-border mb-6">
        {(["changes", "history", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "changes" && (
        <section>
          {isRunning && (
            <div className="card p-5 mb-6">
              <AgentActivity logs={liveLogs} live run={liveRun ?? undefined} />
            </div>
          )}

          {!isRunning && displayRun && viewingRunId && (
            <p className="text-xs text-muted mb-4">
              Viewing snapshot from {formatDateTime(displayRun.completedAt || displayRun.startedAt)} —{" "}
              <button onClick={() => setSearchParams({})} className="text-primary hover:underline">
                back to latest
              </button>
            </p>
          )}

          {!isRunning && displayRun?.status === "failed" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 mb-4">
              <h2 className="text-base font-semibold text-high mb-1">We couldn't capture this page</h2>
              <p className="text-sm text-ink">{displayRun.error?.message || "The capture failed."}</p>
              <p className="text-sm text-muted mt-2">The previous successful snapshot remains the current baseline.</p>
            </div>
          )}

          {!isRunning && !displayRun && (
            <p className="text-sm text-muted">No runs yet. Click "Run now" to capture a baseline.</p>
          )}

          {!isRunning && isBaseline && displayRun && (
            <BaselineReport run={displayRun} monitor={monitor} />
          )}

          {!isRunning && isComparison && displayChanges && displayChanges.meaningful.length === 0 && (
            <div className="card p-5 mb-4">
              <h2 className="text-base font-semibold text-ink mb-1">✓ No meaningful changes detected</h2>
              <p className="text-sm text-muted">This page was materially unchanged since the previous scan.</p>
            </div>
          )}

          {!isRunning && isComparison && displayChanges && displayChanges.meaningful.length > 0 && (
            <>
              <div className="flex items-start justify-between gap-4">
                <ReportSummary meaningful={displayChanges.meaningful} cosmeticCount={displayChanges.cosmetic.length} />
                <button
                  onClick={() => displayRun && handleDownloadPdf(displayRun.id)}
                  disabled={downloadingPdf}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-50 shrink-0 mt-1"
                >
                  <Download className="h-3.5 w-3.5" />
                  {downloadingPdf ? "Preparing PDF…" : "Download PDF"}
                </button>
              </div>
              <div className="space-y-4 mb-6">
                {groupByKey(displayChanges.meaningful).map((group) => (
                  <ChangeCard key={group[0].groupKey} changes={group} />
                ))}
              </div>
            </>
          )}

          {!isRunning && isComparison && displayChanges && displayChanges.cosmetic.length > 0 && (
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
                    <div key={c.groupKey} className="rounded-lg border border-border p-3 text-sm">
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

          {!isRunning && displayRun && (
            <div className="card p-5 mt-6">
              <AgentActivity logs={displayLogs} live={false} run={displayRun} />
            </div>
          )}
        </section>
      )}

      {tab === "history" && (
        <SnapshotTimeline snapshots={snapshots} runs={runs} onSelectRun={handleSelectRun} selectedRunId={displayRun?.id} />
      )}

      {tab === "settings" && (
        <section className="card p-5 max-w-md">
          <h3 className="text-sm font-semibold text-ink mb-1">Automatic checks</h3>
          <p className="text-xs text-muted mb-4">
            {schedulingDraft
              ? "Automatic checks are on. Checks run automatically on the schedule below."
              : "Automatic checks are off. This monitor will only run when you select “Run now”."}
          </p>

          <div className="flex items-center justify-between mb-4">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={schedulingDraft}
                onChange={(e) => setSchedulingDraft(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
              />
              <span className="text-sm text-ink">Enable scheduled checks</span>
            </label>
            {monitor.schedulingEnabled && (
              <button
                onClick={handlePauseNow}
                disabled={savingSchedule}
                className="text-sm font-medium text-muted hover:text-ink disabled:opacity-50"
              >
                Pause
              </button>
            )}
          </div>

          {schedulingDraft && (
            <>
              <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="frequency">
                Check frequency
              </label>
              <select
                id="frequency"
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                value={frequencyDraft}
                onChange={(e) => setFrequencyDraft(e.target.value)}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted mb-4">
                Next check: {monitor.schedulingEnabled && frequencyDraft === monitor.scheduleFrequency ? formatDateTime(monitor.nextRunAt) : "Calculated once saved"}
              </p>
            </>
          )}

          <button onClick={handleSaveSchedule} disabled={savingSchedule || !scheduleDirty} className="btn-primary disabled:opacity-50">
            {savingSchedule ? "Saving…" : "Save schedule"}
          </button>

          <div className="mt-8 pt-6 border-t border-border">
            <h3 className="text-sm font-semibold text-ink mb-1">Monitor management</h3>
            <p className="text-xs text-muted mb-3">Manage this monitor and its stored scan history.</p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-high transition-colors hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete monitor
            </button>
            <p className="text-xs text-muted mt-2">
              Permanently removes this monitor, its snapshots, run history, and change reports.
            </p>
          </div>
        </section>
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete this monitor?"
          description="This will permanently delete the monitor and its scan history. This action cannot be undone."
          confirmLabel="Delete monitor"
          requireTypedConfirmation={monitorHostname(monitor.url)}
          onConfirm={handleDeleteMonitor}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

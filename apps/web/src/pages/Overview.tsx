import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useRun } from "../hooks/useRun";
import { AgentTrail } from "../components/AgentTrail";
import { ChangeCard } from "../components/ChangeCard";
import { groupByKey } from "../lib/groupChanges";
import { downloadReportPdf } from "../lib/downloadPdf";
import { ChevronDown, ChevronRight, Download } from "lucide-react";

export function Overview() {
  const [url, setUrl] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [monitorId, setMonitorId] = useState<string | null>(null);
  const [alreadyMonitored, setAlreadyMonitored] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [showCosmetic, setShowCosmetic] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { run, logs, changes } = useRun(runId);

  async function handleDownloadPdf() {
    if (!runId) return;
    setDownloadingPdf(true);
    try {
      await downloadReportPdf(runId, url);
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleRun() {
    if (!url.trim()) return;
    setStarting(true);
    setStartError(null);
    try {
      const result = await api.startRun(url.trim());
      setRunId(result.runId);
      setMonitorId(result.monitorId);
      setAlreadyMonitored(result.alreadyMonitored);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setStarting(false);
    }
  }

  const isRunning = run && !["completed", "partial", "failed"].includes(run.status);
  const isFirstRun = run && (run.status === "completed" || run.status === "partial") && !run.previousSnapshotId;
  const isNoChange =
    changes && run && (run.status === "completed" || run.status === "partial") && changes.meaningful.length === 0;

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-ink">Web Change Intelligence</h1>
        <p className="text-muted mt-1">Monitor important changes across the webpages you care about.</p>
      </header>

      <div className="rounded-lg border border-border bg-white p-4 shadow-sm mb-4">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Paste a webpage URL…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRun()}
            aria-label="Webpage URL"
          />
          <button
            onClick={handleRun}
            disabled={starting || Boolean(isRunning)}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {starting ? "Starting…" : "Run"}
          </button>
        </div>
        <p className="text-xs text-muted mt-2">
          We'll capture the page and compare future runs against the latest successful snapshot.
        </p>
        {startError && <p className="text-sm text-high mt-2">{startError}</p>}
        {alreadyMonitored && (
          <p className="text-xs text-muted mt-2">This page is already being monitored — running it again.</p>
        )}
      </div>

      {run && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-sm mb-6">
          <h2 className="text-sm font-semibold text-ink mb-4">
            {isRunning ? "Agent is running…" : "Agent Trail"}
          </h2>
          <AgentTrail logs={logs} live={Boolean(isRunning)} />
          {monitorId && !isRunning && (
            <Link to={`/monitors/${monitorId}`} className="inline-block mt-4 text-sm font-medium text-primary hover:underline">
              Open full monitor →
            </Link>
          )}
        </section>
      )}

      {run?.status === "failed" && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-5">
          <h2 className="text-base font-semibold text-high mb-1">We couldn't capture this page</h2>
          <p className="text-sm text-ink">{run.error?.message || "The capture failed."}</p>
          <p className="text-sm text-muted mt-2">
            Your previous successful snapshot is safe and remains the current baseline.
          </p>
        </section>
      )}

      {isFirstRun && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-ink mb-1">✓ Baseline created</h2>
          <p className="text-sm text-muted">
            We captured this page as your starting snapshot. No comparison is available yet — future runs
            will compare the latest version against this baseline.
          </p>
        </section>
      )}

      {isNoChange && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-ink mb-1">✓ No meaningful changes detected</h2>
          <p className="text-sm text-muted">This page is materially unchanged since the last successful snapshot.</p>
          {changes && changes.cosmetic.length > 0 && (
            <p className="text-sm text-muted mt-1">
              {changes.cosmetic.length} cosmetic change(s) were detected and excluded from this summary.
            </p>
          )}
        </section>
      )}

      {changes && changes.meaningful.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Meaningful changes</h2>
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {downloadingPdf ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
          {groupByKey(changes.meaningful).map((group) => (
            <ChangeCard key={group[0].groupKey} changes={group} />
          ))}
        </section>
      )}

      {changes && changes.cosmetic.length > 0 && (
        <section className="mt-6">
          <button
            onClick={() => setShowCosmetic((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
          >
            {showCosmetic ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Other detected changes ({changes.cosmetic.length})
          </button>
          {showCosmetic && (
            <div className="mt-3 space-y-3">
              {changes.cosmetic.map((c) => (
                <div key={c.groupKey} className="rounded-md border border-border p-3 text-sm">
                  <p className="text-ink">{c.elementLabel || c.groupTitle}: {c.beforeValue} → {c.afterValue}</p>
                  <p className="text-muted text-xs mt-1">Classification: {c.classification}. {c.whyItMatters}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

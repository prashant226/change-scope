import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useRun } from "../hooks/useRun";
import { AgentActivity } from "../components/AgentActivity";
import { ChangeCard } from "../components/ChangeCard";
import { ReportSummary } from "../components/ReportSummary";
import { BaselineReport } from "../components/BaselineReport";
import { PageHeader } from "../components/PageHeader";
import { groupByKey } from "../lib/groupChanges";
import { downloadReportPdf } from "../lib/downloadPdf";
import type { MonitorRecord } from "../types/api";
import { ArrowRight, ChevronDown, ChevronRight, Download, Globe } from "lucide-react";

export function Overview() {
  const [url, setUrl] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [monitorId, setMonitorId] = useState<string | null>(null);
  const [monitor, setMonitor] = useState<MonitorRecord | null>(null);
  const [alreadyMonitored, setAlreadyMonitored] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [showCosmetic, setShowCosmetic] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { run, logs, changes } = useRun(runId);

  const isRunning = run && !["completed", "partial", "failed"].includes(run.status);

  // Fetch the monitor record (for the baseline report's "what happens next"
  // scheduling text) once the run has actually finished — nextRunAt is only
  // meaningful after the orchestrator has updated it.
  useEffect(() => {
    if (monitorId && !isRunning && run) {
      api.getMonitor(monitorId).then((r) => setMonitor(r.monitor)).catch(() => undefined);
    }
  }, [monitorId, isRunning, run?.status]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const isBaseline = run && (run.status === "completed" || run.status === "partial") && run.reportType === "baseline";
  const isComparison = run && (run.status === "completed" || run.status === "partial") && run.reportType === "comparison";
  const isNoChange = isComparison && changes && changes.meaningful.length === 0;

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <PageHeader
        title="Web Change Intelligence"
        subtitle="Monitor important changes across the webpages you care about."
      />

      <div className="card p-5 mb-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={2} />
            <input
              className="w-full rounded-lg border border-border pl-10 pr-3 py-2.5 text-[15px] placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-shadow"
              placeholder="Paste a webpage URL…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRun()}
              aria-label="Webpage URL"
            />
          </div>
          <button
            onClick={handleRun}
            disabled={starting || Boolean(isRunning)}
            className="btn-primary flex items-center gap-1.5 px-6 py-2.5 text-[15px]"
          >
            {starting ? "Starting…" : "Run"}
            {!starting && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted mt-2.5">
          We'll capture the page and compare future runs against the latest successful snapshot.
        </p>
        {startError && <p className="text-sm text-high mt-2">{startError}</p>}
        {alreadyMonitored && (
          <p className="text-xs text-muted mt-2">This page is already being monitored — running it again.</p>
        )}
      </div>

      {run && (
        <section className="card p-5 mb-6">
          <AgentActivity logs={logs} live={Boolean(isRunning)} run={run} />
          {monitorId && !isRunning && (
            <Link
              to={`/monitors/${monitorId}`}
              className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-primary hover:underline"
            >
              Open full monitor <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </section>
      )}

      {run?.status === "failed" && (
        <section className="card border-red-200 bg-red-50 p-5">
          <h2 className="text-base font-semibold text-high mb-1">We couldn't capture this page</h2>
          <p className="text-sm text-ink">{run.error?.message || "The capture failed."}</p>
          <p className="text-sm text-muted mt-2">
            Your previous successful snapshot is safe and remains the current baseline.
          </p>
        </section>
      )}

      {isBaseline && run && monitor && <BaselineReport run={run} monitor={monitor} />}

      {isNoChange && (
        <section className="card p-5">
          <h2 className="text-base font-semibold text-ink mb-1">✓ No meaningful changes detected</h2>
          <p className="text-sm text-muted">This page is materially unchanged since the previous successful scan.</p>
          {changes && changes.cosmetic.length > 0 && (
            <p className="text-sm text-muted mt-1">
              {changes.cosmetic.length} cosmetic change{changes.cosmetic.length === 1 ? "" : "s"} detected and
              excluded from this summary.
            </p>
          )}
        </section>
      )}

      {isComparison && changes && changes.meaningful.length > 0 && (
        <section>
          <div className="flex items-start justify-between gap-4">
            <ReportSummary meaningful={changes.meaningful} cosmeticCount={changes.cosmetic.length} />
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-50 shrink-0 mt-1"
            >
              <Download className="h-3.5 w-3.5" />
              {downloadingPdf ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
          <div className="space-y-4">
            {groupByKey(changes.meaningful).map((group) => (
              <ChangeCard key={group[0].groupKey} changes={group} />
            ))}
          </div>
        </section>
      )}

      {isComparison && changes && changes.cosmetic.length > 0 && (
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
                <div key={c.groupKey} className="rounded-lg border border-border p-3 text-sm">
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

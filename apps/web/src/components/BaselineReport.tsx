import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Image as ImageIcon, MousePointerClick, Layers } from "lucide-react";
import { api } from "../lib/api";
import type { BaselineSummary, MonitorRecord, RunRecord } from "../types/api";
import { formatDateTime, FREQUENCY_LABELS } from "../lib/format";

/**
 * The report shown for a run with no previous snapshot to compare against
 * (reportType === "baseline"). Answers "what did the agent capture and
 * understand from this webpage?" — never a fake "no changes" comparison.
 */
export function BaselineReport({ run, monitor }: { run: RunRecord; monitor: MonitorRecord }) {
  const [summary, setSummary] = useState<BaselineSummary | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    api.getBaselineSummary(run.id).then(setSummary).catch(() => setSummary(null));
  }, [run.id]);

  async function handleViewPreview() {
    setShowPreview(true);
    if (previewUrl || previewError) return;
    try {
      const { url } = await api.getScreenshotUrl(run.id);
      setPreviewUrl(url);
    } catch {
      setPreviewError("No page preview is available for this scan.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1.5">
          <CheckCircle2 className="h-5 w-5 text-low" strokeWidth={2} />
          <h2 className="text-[17px] font-semibold text-ink">Baseline Scan Complete</h2>
        </div>
        <p className="text-sm text-muted">
          We captured this page as your starting snapshot. Future scans will compare against this version.
        </p>
      </div>

      {summary && (
        <>
          <div className="card p-5">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted mb-3">What we captured</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile icon={Layers} value={summary.stats.sectionCount} label="Sections" />
              <StatTile icon={FileText} value={summary.stats.contentElementCount} label="Content elements" />
              <StatTile icon={MousePointerClick} value={summary.stats.interactiveElementCount} label="Interactive elements" />
              <StatTile icon={ImageIcon} value={summary.stats.imageCount} label="Images" />
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted mb-3">Page overview</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted w-20 shrink-0">Title</dt>
                <dd className="text-ink">{summary.pageTitle || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted w-20 shrink-0">URL</dt>
                <dd className="text-ink break-all">{summary.finalUrl}</dd>
              </div>
            </dl>
          </div>

          {summary.sectionHeadings.length > 0 && (
            <div className="card p-5">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted mb-3">Page structure</h3>
              <div className="flex flex-wrap gap-2">
                {summary.sectionHeadings.map((heading, i) => (
                  <span key={i} className="text-sm text-ink bg-soft border border-border rounded-md px-2.5 py-1">
                    {heading}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted mb-3">Snapshot evidence</h3>
            <div className="flex gap-2">
              <button onClick={handleViewPreview} className="btn-secondary flex items-center gap-1.5 text-sm">
                <ExternalLink className="h-3.5 w-3.5" />
                View page preview
              </button>
            </div>
            {showPreview && (
              <div className="mt-4">
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Captured page preview"
                    className="w-full rounded-lg border border-border"
                  />
                )}
                {previewError && <p className="text-sm text-muted">{previewError}</p>}
                {!previewUrl && !previewError && <p className="text-sm text-muted">Loading preview…</p>}
              </div>
            )}
          </div>
        </>
      )}

      <div className="card p-5">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted mb-2">What happens next?</h3>
        <p className="text-sm text-ink leading-relaxed">
          On the next successful scan, we'll compare the new page state against this baseline and surface
          meaningful changes.
        </p>
        <p className="text-sm text-muted mt-2">
          {monitor.status === "paused"
            ? "This monitor is paused — run it manually any time to compare against this baseline."
            : monitor.nextRunAt
              ? `Next check: ${formatDateTime(monitor.nextRunAt)} (${FREQUENCY_LABELS[monitor.scheduleFrequency] || monitor.scheduleFrequency})`
              : "Run the scan again whenever you want to compare the page."}
        </p>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, value, label }: { icon: typeof Layers; value: number; label: string }) {
  return (
    <div className="rounded-lg bg-soft border border-border px-3 py-3 text-center">
      <Icon className="h-4 w-4 text-primary mx-auto mb-1.5" strokeWidth={2} />
      <p className="text-lg font-semibold text-ink leading-none">{value}</p>
      <p className="text-[11px] text-muted mt-1">{label}</p>
    </div>
  );
}

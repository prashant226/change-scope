import { useState } from "react";
import { X } from "lucide-react";
import { api } from "../lib/api";
import type { MonitorRecord, ScheduleFrequency } from "../types/api";
import { relativeTime, FREQUENCY_LABELS } from "../lib/format";

const FREQUENCIES: { value: ScheduleFrequency; label: string }[] = [
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "2h", label: "2 hours" },
  { value: "6h", label: "6 hours" },
  { value: "12h", label: "12 hours" },
  { value: "24h", label: "24 hours" },
];

/**
 * URL + check frequency are configured together here, in one step — the
 * user's mental model is "monitor this URL every X", not "add a URL, then
 * separately go find where scheduling lives". If the URL turns out to
 * already be monitored, this never creates a duplicate: it swaps into a
 * confirmation view showing the existing schedule and lets the user apply
 * the newly chosen frequency to that same monitor instead.
 */
export function CreateMonitorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [url, setUrl] = useState("");
  const [frequency, setFrequency] = useState<ScheduleFrequency>("6h");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<MonitorRecord | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit() {
    if (!url.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.createMonitor(url.trim(), true, frequency);
      if (result.alreadyMonitored) {
        setExisting(result.monitor);
        setFrequency(result.monitor.scheduleFrequency);
      } else {
        setSuccess(`We'll check this page ${FREQUENCY_LABELS[frequency].toLowerCase()}.`);
        setTimeout(onCreated, 900);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateExisting() {
    if (!existing) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.updateMonitor(existing.id, { schedulingEnabled: true, scheduleFrequency: frequency });
      setSuccess(`This page will now be checked ${FREQUENCY_LABELS[frequency].toLowerCase()}.`);
      setTimeout(onCreated, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-popover">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[17px] font-semibold text-ink tracking-tight">Monitor a webpage</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted transition-colors hover:bg-soft hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <p className="text-sm text-low font-medium py-2">✓ {existing ? "Monitoring updated" : "Monitoring started"} — {success}</p>
        ) : existing ? (
          <>
            <p className="text-sm font-medium text-ink mb-1">
              {existing.schedulingEnabled ? "This page is already being monitored." : "This page is already monitored."}
            </p>
            <p className="text-xs text-muted mb-4">
              Last checked: {relativeTime(existing.lastRunAt)}
              {existing.schedulingEnabled
                ? ` · Current schedule: ${FREQUENCY_LABELS[existing.scheduleFrequency] || existing.scheduleFrequency}`
                : " · Automatic checks are currently off."}
            </p>

            <label className="block text-xs font-medium text-muted mb-1.5">How often should we check this page?</label>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFrequency(f.value)}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                    frequency === f.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-ink hover:bg-soft"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {error && <p className="text-sm text-high mb-3">{error}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-soft">
                Cancel
              </button>
              <button onClick={handleUpdateExisting} disabled={submitting} className="btn-primary">
                {submitting ? "Updating…" : existing.schedulingEnabled ? "Update schedule" : "Enable monitoring"}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="monitor-url">
              URL
            </label>
            <input
              id="monitor-url"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="https://example.com/page"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />

            <label className="block text-xs font-medium text-muted mb-1.5">How often should we check this page?</label>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFrequency(f.value)}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                    frequency === f.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-ink hover:bg-soft"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {error && <p className="text-sm text-high mb-3">{error}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-soft">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting || !url.trim()} className="btn-primary">
                {submitting ? "Starting…" : "Start monitoring"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

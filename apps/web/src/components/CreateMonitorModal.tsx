import { useState } from "react";
import { X } from "lucide-react";
import { api } from "../lib/api";

const FREQUENCIES = [
  { value: "hourly", label: "Every hour" },
  { value: "every_6_hours", label: "Every 6 hours" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

export function CreateMonitorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [url, setUrl] = useState("");
  const [frequency, setFrequency] = useState("every_6_hours");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!url.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createMonitor(url.trim(), frequency);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-ink">Monitor a webpage</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block text-xs font-medium text-muted mb-1" htmlFor="monitor-url">
          URL
        </label>
        <input
          id="monitor-url"
          className="w-full rounded-md border border-border px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="https://example.com/page"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        <label className="block text-xs font-medium text-muted mb-1" htmlFor="monitor-frequency">
          Check frequency
        </label>
        <select
          id="monitor-frequency"
          className="w-full rounded-md border border-border px-3 py-2 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-primary"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
        >
          {FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        {error && <p className="text-sm text-high mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-muted hover:bg-soft">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !url.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Starting…" : "Start monitoring"}
          </button>
        </div>
      </div>
    </div>
  );
}

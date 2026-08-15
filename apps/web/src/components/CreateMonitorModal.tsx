import { useState } from "react";
import { X } from "lucide-react";
import { api } from "../lib/api";

export function CreateMonitorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!url.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createMonitor(url.trim());
      onCreated();
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

        <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="monitor-url">
          URL
        </label>
        <input
          id="monitor-url"
          className="w-full rounded-lg border border-border px-3 py-2.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          placeholder="https://example.com/page"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
        />
        <p className="text-xs text-muted mb-5">
          You can turn on automatic checks later from the monitor's settings — this just adds it.
        </p>

        {error && <p className="text-sm text-high mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-soft">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting || !url.trim()} className="btn-primary">
            {submitting ? "Adding…" : "Add monitor"}
          </button>
        </div>
      </div>
    </div>
  );
}

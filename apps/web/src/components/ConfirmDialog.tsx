import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/** Reusable confirmation modal for destructive, irreversible actions — never a bare browser confirm(). */
export function ConfirmDialog({
  title,
  subtitle,
  description,
  confirmLabel,
  requireTypedConfirmation,
  onConfirm,
  onClose,
}: {
  title: string;
  /** Optional secondary line under the title (e.g. the monitor's URL) — plain muted text, not part of the title itself. */
  subtitle?: string;
  description: string;
  confirmLabel: string;
  /** When set, the user must type this exact text before the confirm button enables — extra friction for the most destructive actions. */
  requireTypedConfirmation?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  const canConfirm = !requireTypedConfirmation || typed === requireTypedConfirmation;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-popover">
        <div className="flex items-start justify-between mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-4.5 w-4.5 text-high" strokeWidth={2} />
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted transition-colors hover:bg-soft hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="text-[16px] font-semibold text-ink mb-0.5">{title}</h2>
        {subtitle && <p className="text-xs text-muted mb-2 break-all">{subtitle}</p>}
        <p className="text-sm text-muted mb-4 leading-relaxed whitespace-pre-line">{description}</p>

        {requireTypedConfirmation && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="confirm-text">
              Type <span className="font-semibold text-ink">{requireTypedConfirmation}</span> to confirm
            </label>
            <input
              id="confirm-text"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-high/30 focus:border-high"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        {error && <p className="text-sm text-high mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-soft">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || !canConfirm}
            className="rounded-lg bg-high px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

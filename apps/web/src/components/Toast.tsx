import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

/**
 * A subtle, auto-dismissing confirmation — deliberately not another modal.
 * Used for "did the thing I asked for actually happen?" feedback after an
 * action that already had its own confirmation step (e.g. a delete).
 */
export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-medium text-white shadow-popover"
    >
      <CheckCircle2 className="h-4 w-4 text-low shrink-0" strokeWidth={2} />
      {message}
    </div>
  );
}

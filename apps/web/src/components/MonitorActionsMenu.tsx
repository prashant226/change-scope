import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, ExternalLink, Trash2 } from "lucide-react";

/**
 * Compact secondary actions for the monitor currently selected elsewhere on
 * the page (e.g. History's monitor picker) — deliberately not a permanent
 * button row, so a destructive action never visually competes with the
 * primary selector/content next to it.
 */
export function MonitorActionsMenu({ onOpenMonitor, onDeleteMonitor }: { onOpenMonitor: () => void; onDeleteMonitor: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="More monitor actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-soft hover:text-ink"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Monitor actions"
          className="absolute right-0 z-20 mt-1.5 w-48 rounded-lg border border-border bg-white py-1 shadow-popover"
        >
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenMonitor();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-soft"
          >
            <ExternalLink className="h-3.5 w-3.5 text-muted" strokeWidth={2} />
            Open monitor
          </button>
          <div className="my-1 border-t border-border" />
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDeleteMonitor();
            }}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-high transition-colors hover:bg-red-50"
          >
            Delete monitor
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}

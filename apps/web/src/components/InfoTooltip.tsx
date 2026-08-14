import { useState, useId } from "react";
import { Info } from "lucide-react";

/**
 * Small "ⓘ" affordance that reveals an explanation on hover/focus. Used next to
 * metric labels and chart titles that aren't self-explanatory at a glance.
 */
export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-describedby={id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="text-muted hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 rounded-full"
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-ink text-white text-xs leading-relaxed px-3 py-2 shadow-lg"
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink" />
        </span>
      )}
    </span>
  );
}

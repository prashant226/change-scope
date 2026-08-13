import type { AnalyzedChange } from "../types/api";

const IMPACT_STYLES: Record<AnalyzedChange["significance"], { label: string; badge: string }> = {
  high: { label: "High Impact", badge: "bg-red-50 text-high border-red-200" },
  medium: { label: "Medium Impact", badge: "bg-amber-50 text-medium border-amber-200" },
  low: { label: "Low Impact", badge: "bg-green-50 text-low border-green-200" },
};

export function ChangeCard({ change }: { change: AnalyzedChange }) {
  const impact = IMPACT_STYLES[change.significance];
  return (
    <article className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${impact.badge}`}>{impact.label}</span>
        <span className="text-xs text-muted">{change.section || "General"}</span>
      </div>
      <h3 className="text-base font-semibold text-ink mb-3">{change.groupTitle}</h3>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-1">Before</p>
          <p className="text-sm text-ink break-words">{change.beforeValue || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-1">Now</p>
          <p className="text-sm text-ink break-words">{change.afterValue || "—"}</p>
        </div>
      </div>

      <div className="rounded-md bg-soft p-3">
        <p className="text-xs uppercase tracking-wide text-muted mb-1">Why it might be significant</p>
        <p className="text-sm text-ink">{change.whyItMatters}</p>
      </div>
    </article>
  );
}

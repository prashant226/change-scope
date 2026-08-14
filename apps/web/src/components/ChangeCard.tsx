import type { AnalyzedChange } from "../types/api";

const IMPACT_STYLES: Record<AnalyzedChange["significance"], { label: string; badge: string }> = {
  high: { label: "High Impact", badge: "bg-red-50 text-high border-red-200" },
  medium: { label: "Medium Impact", badge: "bg-amber-50 text-medium border-amber-200" },
  low: { label: "Low Impact", badge: "bg-green-50 text-low border-green-200" },
};

/**
 * Renders one grouped change event. `changes` may contain more than one raw
 * change sharing the same groupKey (e.g. a price + its discount changing
 * together) — those render as multiple before/after rows under one heading
 * and one shared explanation, instead of duplicate cards (§20, §51).
 */
export function ChangeCard({ changes }: { changes: AnalyzedChange[] }) {
  const first = changes[0];
  const impact = IMPACT_STYLES[first.significance];

  return (
    <article className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${impact.badge}`}>{impact.label}</span>
        <span className="text-xs text-muted">{first.section || "General"}</span>
      </div>
      <h3 className="text-base font-semibold text-ink mb-3">{first.groupTitle}</h3>

      <div className="space-y-3 mb-3">
        {changes.map((c, i) => (
          <div key={i} className="grid grid-cols-2 gap-4">
            <div>
              {changes.length > 1 && <p className="text-xs text-muted mb-1">{c.elementLabel}</p>}
              <p className="text-xs uppercase tracking-wide text-muted mb-1">Before</p>
              <p className="text-sm text-ink break-words">{c.beforeValue || "—"}</p>
            </div>
            <div>
              {changes.length > 1 && <p className="text-xs text-muted mb-1">&nbsp;</p>}
              <p className="text-xs uppercase tracking-wide text-muted mb-1">Now</p>
              <p className="text-sm text-ink break-words">{c.afterValue || "—"}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-md bg-soft p-3">
        <p className="text-xs uppercase tracking-wide text-muted mb-1">Why it might be significant</p>
        <p className="text-sm text-ink">{first.whyItMatters}</p>
      </div>
    </article>
  );
}

import type { AnalyzedChange } from "../types/api";

const IMPACT_STYLES: Record<AnalyzedChange["significance"], { label: string; badge: string; bar: string }> = {
  high: { label: "High Impact", badge: "bg-red-50 text-high border-red-200", bar: "bg-high" },
  medium: { label: "Medium Impact", badge: "bg-amber-50 text-medium border-amber-200", bar: "bg-medium" },
  low: { label: "Low Impact", badge: "bg-green-50 text-low border-green-200", bar: "bg-low" },
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
    <article className="card overflow-hidden">
      <div className={`h-1 ${impact.bar}`} />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2.5">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${impact.badge}`}>{impact.label}</span>
          <span className="text-xs text-muted">{first.section || "General"}</span>
        </div>
        <h3 className="text-[15px] font-semibold text-ink mb-3.5">{first.groupTitle}</h3>

        <div className="space-y-3 mb-3.5">
          {changes.map((c, i) => (
            <div key={i}>
              {changes.length > 1 && <p className="text-xs font-medium text-muted mb-1.5">{c.elementLabel}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-red-50/60 border border-red-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-high/70 mb-0.5">Before</p>
                  <p className="text-sm text-ink break-words">{c.beforeValue || "—"}</p>
                </div>
                <div className="rounded-lg bg-green-50/60 border border-green-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-low/70 mb-0.5">Now</p>
                  <p className="text-sm text-ink break-words">{c.afterValue || "—"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-soft px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">Why it might be significant</p>
          <p className="text-sm text-ink leading-relaxed">{first.whyItMatters}</p>
        </div>
      </div>
    </article>
  );
}

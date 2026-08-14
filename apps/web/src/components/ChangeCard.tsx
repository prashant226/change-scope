import type { AnalyzedChange } from "../types/api";

const IMPACT_STYLES: Record<AnalyzedChange["significance"], { label: string; text: string; bar: string }> = {
  high: { label: "High Impact", text: "text-high", bar: "bg-high" },
  medium: { label: "Medium Impact", text: "text-medium", bar: "bg-medium" },
  low: { label: "Low Impact", text: "text-low", bar: "bg-low" },
};

/**
 * Renders one grouped change event. `changes` may contain more than one raw
 * change sharing the same groupKey (e.g. a price + its discount changing
 * together) — those render as multiple before/after rows under one heading,
 * one "what changed" summary, and one shared explanation, instead of
 * duplicate cards. Layout follows the spec exactly:
 * [Section] · [Impact] / What changed / Before / Now / Why it might matter —
 * no extra fields.
 */
export function ChangeCard({ changes }: { changes: AnalyzedChange[] }) {
  const first = changes[0];
  const impact = IMPACT_STYLES[first.significance];

  return (
    <article className="card overflow-hidden">
      <div className={`h-1 ${impact.bar}`} />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-[15px] font-semibold text-ink">
            {first.groupTitle} <span className="text-muted font-normal">·</span>{" "}
            <span className={`font-semibold ${impact.text}`}>{impact.label}</span>
          </h3>
          {first.needsReview && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md border bg-soft text-muted border-border">
              Needs review
            </span>
          )}
        </div>

        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">What changed</p>
          <p className="text-sm text-ink leading-relaxed">{first.whatChanged}</p>
        </div>

        <div className="space-y-3 mb-4">
          {changes.map((c, i) => (
            <div key={i}>
              {changes.length > 1 && <p className="text-xs font-medium text-muted mb-1.5">{c.elementLabel}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-soft border border-border px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-0.5">Before</p>
                  <p className="text-sm text-ink break-words">{c.beforeValue || "—"}</p>
                </div>
                <div className="rounded-lg bg-white border border-primary/20 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-0.5">Now</p>
                  <p className="text-sm text-ink font-medium break-words">{c.afterValue || "—"}</p>
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

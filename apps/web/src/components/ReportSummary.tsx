import type { AnalyzedChange } from "../types/api";
import { groupByKey } from "../lib/groupChanges";

const IMPACT_ORDER: Array<AnalyzedChange["significance"]> = ["high", "medium", "low"];
const IMPACT_LABEL: Record<AnalyzedChange["significance"], string> = {
  high: "High Impact",
  medium: "Medium Impact",
  low: "Low Impact",
};
const IMPACT_DOT: Record<AnalyzedChange["significance"], string> = {
  high: "bg-high",
  medium: "bg-medium",
  low: "bg-low",
};

/** Top-of-report summary: counts logical change GROUPS, not raw rows (§11 in the diff-reasoning spec). */
export function ReportSummary({ meaningful, cosmeticCount }: { meaningful: AnalyzedChange[]; cosmeticCount: number }) {
  const groups = groupByKey(meaningful);
  const byImpact = new Map<AnalyzedChange["significance"], number>();
  for (const group of groups) {
    const sig = group[0].significance;
    byImpact.set(sig, (byImpact.get(sig) || 0) + 1);
  }

  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-ink tracking-tight">
        {groups.length} meaningful {groups.length === 1 ? "change" : "changes"} detected
      </h2>
      {groups.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
          {IMPACT_ORDER.filter((sig) => byImpact.get(sig)).map((sig) => (
            <span key={sig} className="flex items-center gap-1.5 text-sm text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${IMPACT_DOT[sig]}`} />
              {byImpact.get(sig)} {IMPACT_LABEL[sig]}
            </span>
          ))}
        </div>
      )}
      {cosmeticCount > 0 && (
        <p className="text-sm text-muted mt-1.5">
          {cosmeticCount} cosmetic {cosmeticCount === 1 ? "change" : "changes"} excluded
        </p>
      )}
    </div>
  );
}

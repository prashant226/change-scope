/**
 * Dev-only structured debug output (§27) — prints exactly why each raw
 * change was classified the way it was, so a "why didn't X show up?" /
 * "why did Y get suppressed?" question during development can be answered
 * from the server console instead of guessing. Gated behind DEBUG_DIFF=1
 * (see utils/config.ts) — never called from a production code path with
 * the flag unset, and never exposed through the API or UI.
 */
import type { RawChange } from "../types/change.js";

export function logDiffDebug(rawChanges: RawChange[]): void {
  // eslint-disable-next-line no-console
  console.debug(
    "[diff-debug] %d raw change(s):\n%s",
    rawChanges.length,
    rawChanges
      .map((c) => {
        const suppressedBy = (c.evidence?.suppressedBy as string | undefined) ?? undefined;
        const suppressedChildren = c.evidence?.suppressedChildSections as string[] | undefined;
        return [
          `  entity=${c.elementLabel ?? "(section)"}`,
          `section=${c.section ?? "-"}`,
          `changeType=${c.changeType}`,
          `classification=${c.classification}`,
          `before=${truncate(c.beforeValue)}`,
          `after=${truncate(c.afterValue)}`,
          suppressedBy ? `suppressedBy=${suppressedBy}` : undefined,
          suppressedChildren ? `suppressedChildSections=[${suppressedChildren.join(", ")}]` : undefined,
        ]
          .filter(Boolean)
          .join(" ");
      })
      .join("\n"),
  );
}

function truncate(value: string | undefined): string {
  if (!value) return "-";
  return value.length > 60 ? `${value.slice(0, 60)}…` : value;
}

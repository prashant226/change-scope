/**
 * Builds the compact, budget-limited payload sent to OpenAI (§54, §57).
 * We never send full pages — only candidate changes, their before/after
 * values, and their section context.
 */
import type { ChangeGroup } from "../types/change.js";

export interface AiContextItem {
  groupKey: string;
  section?: string;
  pageTitle: string;
  changes: Array<{
    elementLabel?: string;
    changeType: string;
    classification: string;
    before?: string;
    after?: string;
  }>;
}

const MAX_VALUE_CHARS = 200;

function truncate(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.length > MAX_VALUE_CHARS ? value.slice(0, MAX_VALUE_CHARS) + "…" : value;
}

/**
 * Trims the group list to fit within an approximate token budget. Uses a
 * rough 4-chars-per-token heuristic — good enough for a soft budget guard,
 * not exact billing accounting.
 */
export function buildAiContext(
  groups: ChangeGroup[],
  pageTitle: string,
  tokenBudget: number,
): AiContextItem[] {
  const items: AiContextItem[] = groups.map((g) => ({
    groupKey: g.groupKey,
    section: g.section,
    pageTitle,
    changes: g.changes.map((c) => ({
      elementLabel: c.elementLabel,
      changeType: c.changeType,
      classification: c.classification,
      before: truncate(c.beforeValue),
      after: truncate(c.afterValue),
    })),
  }));

  const charBudget = tokenBudget * 4;
  let used = 0;
  const kept: AiContextItem[] = [];
  for (const item of items) {
    const size = JSON.stringify(item).length;
    if (used + size > charBudget && kept.length > 0) break;
    kept.push(item);
    used += size;
  }
  return kept;
}

/** Deterministic diff + AI-enriched change records. See MASTER BUILD PROMPT §48-56. */

export type ChangeType = "added" | "removed" | "modified" | "moved" | "unchanged";

export type Classification =
  | "content"
  | "structural"
  | "functional"
  | "visual"
  | "media"
  | "metadata";

export type Significance = "high" | "medium" | "low";

/** Raw deterministic finding, before AI enrichment. */
export interface RawChange {
  id: string;
  changeType: ChangeType;
  /** Best-effort deterministic guess; AI may refine "meaningful vs noise" but not invent the category. */
  classification: Classification;
  section?: string;
  elementLabel?: string;
  beforeValue?: string;
  afterValue?: string;
  /** Signals passed to the classifier / AI to justify the guess — kept small and factual. */
  evidence?: Record<string, unknown>;
}

/** A cluster of raw changes that likely represent one higher-level event (§51). */
export interface ChangeGroup {
  groupKey: string;
  groupTitle: string;
  section?: string;
  changes: RawChange[];
}

/** Final, AI-enriched change record persisted to the `changes` table and shown in the report. */
export interface AnalyzedChange {
  groupKey: string;
  groupTitle: string;
  section?: string;
  elementLabel?: string;
  changeType: ChangeType;
  classification: Classification;
  beforeValue?: string;
  afterValue?: string;
  meaningful: boolean;
  significance: Significance;
  /** One grounded factual sentence: what changed. Kept separate from whyItMatters (interpretation). */
  whatChanged: string;
  whyItMatters: string;
  confidence: number;
  /** True when AI confidence was too low to present the interpretation with certainty — UI shows "Needs review" instead of manufacturing confidence. */
  needsReview: boolean;
  evidence?: Record<string, unknown>;
}

export type RunStage =
  | "received"
  | "validating_url"
  | "finding_previous_snapshot"
  | "opening_page"
  | "rendering"
  | "capturing"
  | "building_snapshot"
  | "saving_snapshot"
  | "comparing"
  | "classifying"
  | "grouping"
  | "ai_reasoning"
  | "building_report"
  | "completed"
  | "failed";

export type RunStatus = "queued" | "running" | "completed" | "partial" | "failed";

/**
 * Every successful run produces a report; which kind depends solely on
 * whether a previous successful snapshot existed for this monitor —
 * never inferred from array order, timestamps, or row order elsewhere.
 * "baseline": first successful capture, nothing to compare against yet.
 * "comparison": a real diff ran (possibly finding zero meaningful changes).
 */
export type ReportType = "baseline" | "comparison";

export interface AgentLogEntry {
  sequence: number;
  timestamp: string;
  stage: RunStage;
  action: string;
  reason: string;
  status: "in_progress" | "completed" | "failed";
  metadata?: Record<string, unknown>;
}

export interface RunErrorInfo {
  code:
    | "invalid_url"
    | "ssrf_blocked"
    | "timeout"
    | "network_error"
    | "dns_error"
    | "http_error"
    | "captcha_blocked"
    | "render_failure"
    | "unknown";
  message: string;
}

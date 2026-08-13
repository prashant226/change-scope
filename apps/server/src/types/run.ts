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

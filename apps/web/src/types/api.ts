export type RunStatus = "queued" | "running" | "completed" | "partial" | "failed";

export interface AgentLogEntry {
  sequence: number;
  timestamp: string;
  stage: string;
  action: string;
  reason: string;
  status: "in_progress" | "completed" | "failed";
  metadata?: Record<string, unknown>;
}

export interface RunErrorInfo {
  code: string;
  message: string;
}

export interface RunRecord {
  id: string;
  monitorId: string;
  status: RunStatus;
  triggerType: "manual" | "scheduled";
  previousSnapshotId?: string;
  currentSnapshotId?: string;
  startedAt: string;
  completedAt?: string;
  error?: RunErrorInfo;
  meaningfulChangeCount: number;
  cosmeticChangeCount: number;
  aiStatus: "pending" | "completed" | "unavailable";
  captureStatus: "pending" | "complete" | "partial" | "failed";
}

export interface AnalyzedChange {
  groupKey: string;
  groupTitle: string;
  section?: string;
  elementLabel?: string;
  changeType: string;
  classification: string;
  beforeValue?: string;
  afterValue?: string;
  meaningful: boolean;
  significance: "high" | "medium" | "low";
  confidence: number;
  whyItMatters: string;
}

export interface MonitorRecord {
  id: string;
  url: string;
  title?: string;
  status: "active" | "paused";
  scheduleFrequency: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

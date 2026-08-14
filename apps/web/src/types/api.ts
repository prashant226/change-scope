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
  whatChanged: string;
  whyItMatters: string;
  needsReview: boolean;
}

export interface MonitorRecord {
  id: string;
  url: string;
  title?: string;
  status: "active" | "paused";
  scheduleFrequency: "hourly" | "every_6_hours" | "daily" | "weekly";
  lastRunAt?: string;
  nextRunAt?: string;
  latestRunId?: string;
  latestRunStatus?: RunStatus;
  latestRunCompletedAt?: string;
  latestMeaningfulChangeCount?: number;
}

export interface SnapshotSummary {
  id: string;
  runId: string;
  versionNumber: number;
  capturedAt: string;
  isSuccessful: boolean;
}

export interface AnalyticsSummary {
  monitorCount: number;
  meaningfulChangeCount: number;
  highImpactChangeCount: number;
  avgChangesPerMonitor: number;
  changesByType: Record<string, number>;
  changesByImpact: Record<"high" | "medium" | "low", number>;
  changesOverTime: Array<{ date: string; count: number }>;
  mostChangedMonitors: Array<{ monitorId: string; title: string; changeCount: number }>;
}

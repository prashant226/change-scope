export type RunStatus = "queued" | "running" | "completed" | "partial" | "failed";
export type ReportType = "baseline" | "comparison";

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
  reportType?: ReportType;
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

/** RunRecord as returned by the History endpoint — includes a compact change preview per run. */
export interface RunWithPreview extends RunRecord {
  topChanges: string[];
  topSignificance: "high" | "medium" | "low" | null;
}

export interface BaselineSummary {
  pageTitle: string;
  finalUrl: string;
  capturedAt: string;
  stats: {
    sectionCount: number;
    contentElementCount: number;
    interactiveElementCount: number;
    imageCount: number;
  };
  sectionHeadings: string[];
  screenshotUrl?: string;
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

/** "What state is the latest scan in?" — entirely separate from schedulingEnabled. */
export type DerivedMonitorStatus = "pending" | "running" | "completed" | "failed";

export interface MonitorRecord {
  id: string;
  url: string;
  title?: string;
  /** Automatic scheduled checks on/off — set only from Monitor → Settings, never implied by run status. */
  schedulingEnabled: boolean;
  scheduleFrequency: "hourly" | "every_6_hours" | "daily" | "weekly";
  lastRunAt?: string;
  /** Meaningless while schedulingEnabled is false — never display or act on it in that case. */
  nextRunAt?: string;
  derivedStatus?: DerivedMonitorStatus;
  latestRunId?: string;
  latestRunStatus?: RunStatus;
  latestRunCompletedAt?: string;
  latestReportType?: ReportType;
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

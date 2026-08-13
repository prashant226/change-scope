import type { PageSnapshot } from "../types/snapshot.js";
import type { AnalyzedChange } from "../types/change.js";
import type { AgentLogEntry, RunErrorInfo, RunStatus } from "../types/run.js";

export type ScheduleFrequency = "hourly" | "every_6_hours" | "daily" | "weekly";
export type MonitorStatus = "active" | "paused";

export interface MonitorRecord {
  id: string;
  userId: string;
  url: string;
  normalizedUrl: string;
  title?: string;
  status: MonitorStatus;
  scheduleFrequency: ScheduleFrequency;
  nextRunAt?: string;
  lastRunAt?: string;
  lastSuccessfulSnapshotId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RunRecord {
  id: string;
  monitorId: string;
  userId: string;
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

export interface SnapshotRecord {
  id: string;
  monitorId: string;
  runId: string;
  versionNumber: number;
  snapshot: PageSnapshot;
  contentHash: string;
  screenshotBuffer?: Buffer;
  rawHtml?: string;
  isSuccessful: boolean;
  createdAt: string;
}

export interface StorageAdapter {
  findMonitorByNormalizedUrl(userId: string, normalizedUrl: string): Promise<MonitorRecord | undefined>;
  createMonitor(input: Omit<MonitorRecord, "id" | "createdAt" | "updatedAt">): Promise<MonitorRecord>;
  getMonitor(id: string): Promise<MonitorRecord | undefined>;
  listMonitors(userId: string): Promise<MonitorRecord[]>;
  updateMonitor(id: string, patch: Partial<MonitorRecord>): Promise<MonitorRecord>;

  createRun(input: Omit<RunRecord, "id" | "startedAt">): Promise<RunRecord>;
  updateRun(id: string, patch: Partial<RunRecord>): Promise<RunRecord>;
  getRun(id: string): Promise<RunRecord | undefined>;
  listRunsForMonitor(monitorId: string): Promise<RunRecord[]>;

  appendLog(runId: string, entry: AgentLogEntry): Promise<void>;
  getLogs(runId: string): Promise<AgentLogEntry[]>;

  saveSnapshot(input: Omit<SnapshotRecord, "id" | "createdAt">): Promise<SnapshotRecord>;
  getLastSuccessfulSnapshot(monitorId: string): Promise<SnapshotRecord | undefined>;
  getSnapshot(id: string): Promise<SnapshotRecord | undefined>;
  listSnapshotsForMonitor(monitorId: string): Promise<SnapshotRecord[]>;

  saveChanges(runId: string, changes: AnalyzedChange[]): Promise<void>;
  getChanges(runId: string): Promise<AnalyzedChange[]>;
}

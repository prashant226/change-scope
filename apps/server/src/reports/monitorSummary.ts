/** Enriches a monitor record with its most recent run's outcome for list views (§15). */
import type { StorageAdapter, MonitorRecord } from "../storage/types.js";

/**
 * "What state is the latest scan in?" — entirely separate from
 * `schedulingEnabled` ("is automatic checking on?"). Never stored: derived
 * fresh from the latest run every time, so it can never drift out of sync.
 * No runs yet → pending. queued/running → running. failed → failed.
 * completed/partial → completed (a partial AI-unavailable run still
 * produced a usable report, so it reads as completed here).
 */
export type DerivedMonitorStatus = "pending" | "running" | "completed" | "failed";

function deriveStatus(latestRunStatus?: string): DerivedMonitorStatus {
  if (!latestRunStatus) return "pending";
  if (latestRunStatus === "queued" || latestRunStatus === "running") return "running";
  if (latestRunStatus === "failed") return "failed";
  return "completed";
}

export interface MonitorSummary extends MonitorRecord {
  derivedStatus: DerivedMonitorStatus;
  latestRunId?: string;
  latestRunStatus?: string;
  latestRunCompletedAt?: string;
  latestReportType?: string;
  latestMeaningfulChangeCount?: number;
}

export async function buildMonitorSummary(store: StorageAdapter, monitor: MonitorRecord): Promise<MonitorSummary> {
  const runs = await store.listRunsForMonitor(monitor.id);
  const latest = runs[0];
  if (!latest) return { ...monitor, derivedStatus: deriveStatus(undefined) };
  return {
    ...monitor,
    derivedStatus: deriveStatus(latest.status),
    latestRunId: latest.id,
    latestRunStatus: latest.status,
    latestRunCompletedAt: latest.completedAt,
    latestReportType: latest.reportType,
    latestMeaningfulChangeCount: latest.meaningfulChangeCount,
  };
}

export async function buildMonitorSummaries(store: StorageAdapter, monitors: MonitorRecord[]): Promise<MonitorSummary[]> {
  return Promise.all(monitors.map((m) => buildMonitorSummary(store, m)));
}

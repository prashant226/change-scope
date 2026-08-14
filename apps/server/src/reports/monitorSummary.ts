/** Enriches a monitor record with its most recent run's outcome for list views (§15). */
import type { StorageAdapter, MonitorRecord } from "../storage/types.js";

export interface MonitorSummary extends MonitorRecord {
  latestRunId?: string;
  latestRunStatus?: string;
  latestRunCompletedAt?: string;
  latestMeaningfulChangeCount?: number;
}

export async function buildMonitorSummary(store: StorageAdapter, monitor: MonitorRecord): Promise<MonitorSummary> {
  const runs = await store.listRunsForMonitor(monitor.id);
  const latest = runs[0];
  if (!latest) return { ...monitor };
  return {
    ...monitor,
    latestRunId: latest.id,
    latestRunStatus: latest.status,
    latestRunCompletedAt: latest.completedAt,
    latestMeaningfulChangeCount: latest.meaningfulChangeCount,
  };
}

export async function buildMonitorSummaries(store: StorageAdapter, monitors: MonitorRecord[]): Promise<MonitorSummary[]> {
  return Promise.all(monitors.map((m) => buildMonitorSummary(store, m)));
}

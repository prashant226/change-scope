/** Aggregates only metrics the product actually knows about (§31) — no vanity charts. */
import type { StorageAdapter } from "../storage/types.js";

export interface AnalyticsSummary {
  monitorCount: number;
  meaningfulChangeCount: number;
  highImpactChangeCount: number;
  avgChangesPerMonitor: number;
  changesByType: Record<string, number>;
  mostChangedMonitors: Array<{ monitorId: string; title: string; changeCount: number }>;
}

export async function buildAnalytics(store: StorageAdapter, userId: string): Promise<AnalyticsSummary> {
  const monitors = await store.listMonitors(userId);

  let meaningfulChangeCount = 0;
  let highImpactChangeCount = 0;
  const changesByType: Record<string, number> = {};
  const perMonitor: Array<{ monitorId: string; title: string; changeCount: number }> = [];

  for (const monitor of monitors) {
    const runs = await store.listRunsForMonitor(monitor.id);
    let monitorChangeCount = 0;
    for (const run of runs) {
      const changes = await store.getChanges(run.id);
      for (const change of changes) {
        if (!change.meaningful) continue;
        meaningfulChangeCount++;
        monitorChangeCount++;
        if (change.significance === "high") highImpactChangeCount++;
        changesByType[change.classification] = (changesByType[change.classification] || 0) + 1;
      }
    }
    perMonitor.push({ monitorId: monitor.id, title: monitor.title || monitor.url, changeCount: monitorChangeCount });
  }

  return {
    monitorCount: monitors.length,
    meaningfulChangeCount,
    highImpactChangeCount,
    avgChangesPerMonitor: monitors.length ? Number((meaningfulChangeCount / monitors.length).toFixed(1)) : 0,
    changesByType,
    mostChangedMonitors: perMonitor.sort((a, b) => b.changeCount - a.changeCount).slice(0, 5),
  };
}

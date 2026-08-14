/** Aggregates only metrics the product actually knows about (§31) — no vanity charts. */
import type { StorageAdapter } from "../storage/types.js";

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

export async function buildAnalytics(store: StorageAdapter, userId: string): Promise<AnalyticsSummary> {
  const monitors = await store.listMonitors(userId);

  let meaningfulChangeCount = 0;
  let highImpactChangeCount = 0;
  const changesByType: Record<string, number> = {};
  const changesByImpact: Record<"high" | "medium" | "low", number> = { high: 0, medium: 0, low: 0 };
  const changesByDate = new Map<string, number>();
  const perMonitor: Array<{ monitorId: string; title: string; changeCount: number }> = [];

  for (const monitor of monitors) {
    const runs = await store.listRunsForMonitor(monitor.id);
    let monitorChangeCount = 0;
    for (const run of runs) {
      const changes = await store.getChanges(run.id);
      const meaningfulChanges = changes.filter((c) => c.meaningful);
      if (meaningfulChanges.length > 0) {
        const date = (run.completedAt || run.startedAt).slice(0, 10);
        changesByDate.set(date, (changesByDate.get(date) || 0) + meaningfulChanges.length);
      }
      for (const change of meaningfulChanges) {
        meaningfulChangeCount++;
        monitorChangeCount++;
        if (change.significance === "high") highImpactChangeCount++;
        changesByImpact[change.significance]++;
        changesByType[change.classification] = (changesByType[change.classification] || 0) + 1;
      }
    }
    perMonitor.push({ monitorId: monitor.id, title: monitor.title || monitor.url, changeCount: monitorChangeCount });
  }

  const changesOverTime = [...changesByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return {
    monitorCount: monitors.length,
    meaningfulChangeCount,
    highImpactChangeCount,
    avgChangesPerMonitor: monitors.length ? Number((meaningfulChangeCount / monitors.length).toFixed(1)) : 0,
    changesByType,
    changesByImpact,
    changesOverTime,
    mostChangedMonitors: perMonitor.sort((a, b) => b.changeCount - a.changeCount).slice(0, 5),
  };
}

/**
 * Lightweight scheduler (§63) — a node-cron loop, not a distributed queue.
 * Checks once a minute for active monitors whose next_run_at has arrived and
 * triggers a run through the exact same orchestrator entry point a manual
 * "Run now" uses; only trigger_type differs ("scheduled" vs "manual").
 */
import cron from "node-cron";
import { getStore } from "../storage/index.js";
import { triggerRun } from "../orchestrator/trigger.js";
import { config } from "../utils/config.js";

const store = getStore();

// Guards against a slow tick overlapping the next one — not a queue, just a
// single in-process flag (§60: simple controls, no Redis).
let tickInFlight = false;

export function startScheduler(): void {
  cron.schedule("* * * * *", () => {
    tick().catch((err) => console.error("[scheduler] Tick failed:", err));
  });
  console.log("[scheduler] Started — checking for due monitors every minute.");
}

async function tick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const due = await store.listDueMonitors(new Date().toISOString());
    if (due.length === 0) return;

    // Cap how many captures we kick off per tick so a burst of due monitors
    // can't spike browser concurrency — the rest simply get picked up on the
    // next tick, since their next_run_at is still in the past.
    const batch = due.slice(0, config.maxBrowserConcurrency);

    for (const monitor of batch) {
      const recentRuns = await store.listRunsForMonitor(monitor.id);
      const latest = recentRuns[0];
      if (latest && (latest.status === "queued" || latest.status === "running")) {
        continue; // a run for this monitor is already in flight — skip this tick
      }

      console.log(`[scheduler] Triggering scheduled run for monitor ${monitor.id} (${monitor.url})`);
      const result = await triggerRun(monitor.userId, monitor.id, "scheduled");
      if ("error" in result) {
        console.warn(`[scheduler] Could not start scheduled run for monitor ${monitor.id}: ${result.error}`);
      }
    }
  } finally {
    tickInFlight = false;
  }
}

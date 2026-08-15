/**
 * Lightweight scheduler (§63) — a periodic tick, not a distributed queue.
 * Checks for active monitors whose next_run_at has arrived and triggers a
 * run through the exact same orchestrator entry point a manual "Run now"
 * uses; only trigger_type differs ("scheduled" vs "manual").
 *
 * Two ways this tick actually fires, depending on where the server runs:
 *  - Local / long-running host (src/index.ts): an in-process node-cron loop
 *    calls `runSchedulerTick()` once a minute.
 *  - Vercel: a serverless function has no persistent process to run that
 *    loop in, so Vercel Cron (see vercel.json) instead calls the
 *    POST /api/cron/tick route (app.ts), which calls the same
 *    `runSchedulerTick()`. Same tick logic either way.
 */
import { getStore } from "../storage/index.js";
import { triggerRun } from "../orchestrator/trigger.js";
import { reconcileStaleRun } from "../orchestrator/reconcileStaleRun.js";
import { config } from "../utils/config.js";

const store = getStore();

// Guards against a slow tick overlapping the next one — not a queue, just a
// single in-process flag (§60: simple controls, no Redis). Only meaningful
// within one process; on Vercel each invocation is its own process, so this
// only protects against overlap within a single long-running deployment.
let tickInFlight = false;

/** Local/long-running-host only — not used on Vercel, see module docblock. */
export function startScheduler(): void {
  import("node-cron").then(({ default: cron }) => {
    cron.schedule("* * * * *", () => {
      runSchedulerTick().catch((err) => console.error("[scheduler] Tick failed:", err));
    });
    console.log("[scheduler] Started — checking for due monitors every minute.");
  });
}

export async function runSchedulerTick(): Promise<{ due: number; triggered: number }> {
  if (tickInFlight) return { due: 0, triggered: 0 };
  tickInFlight = true;
  try {
    const due = await store.listDueMonitors(new Date().toISOString());
    if (due.length === 0) return { due: 0, triggered: 0 };

    // Cap how many captures we kick off per tick so a burst of due monitors
    // can't spike browser concurrency — the rest simply get picked up on the
    // next tick, since their next_run_at is still in the past.
    const batch = due.slice(0, config.maxBrowserConcurrency);
    let triggered = 0;

    for (const monitor of batch) {
      const recentRuns = await store.listRunsForMonitor(monitor.id);
      const latest = recentRuns[0] ? await reconcileStaleRun(recentRuns[0]) : undefined;
      if (latest && (latest.status === "queued" || latest.status === "running")) {
        continue; // a run for this monitor is already in flight — skip this tick
      }

      console.log(`[scheduler] Triggering scheduled run for monitor ${monitor.id} (${monitor.url})`);
      const result = await triggerRun(monitor.userId, monitor.id, "scheduled");
      if ("error" in result) {
        console.warn(`[scheduler] Could not start scheduled run for monitor ${monitor.id}: ${result.error}`);
      } else {
        triggered++;
      }
    }
    return { due: due.length, triggered };
  } finally {
    tickInFlight = false;
  }
}

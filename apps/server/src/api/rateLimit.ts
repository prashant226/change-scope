/** Simple in-process guardrails — no Redis (§60). */
import { config } from "../utils/config.js";

const activeRunsByUser = new Map<string, number>();
const lastRunAtByMonitor = new Map<string, number>();

export function canStartRun(userId: string, monitorId: string): { ok: boolean; reason?: string } {
  const active = activeRunsByUser.get(userId) || 0;
  if (active >= config.maxRunsPerUser) {
    return { ok: false, reason: "Too many runs in progress. Please wait for one to finish." };
  }
  const lastRun = lastRunAtByMonitor.get(monitorId);
  if (lastRun && Date.now() - lastRun < config.runCooldownSeconds * 1000) {
    const waitSec = Math.ceil((config.runCooldownSeconds * 1000 - (Date.now() - lastRun)) / 1000);
    return { ok: false, reason: `Please wait ${waitSec}s before running this monitor again.` };
  }
  return { ok: true };
}

export function markRunStarted(userId: string, monitorId: string) {
  activeRunsByUser.set(userId, (activeRunsByUser.get(userId) || 0) + 1);
  lastRunAtByMonitor.set(monitorId, Date.now());
}

export function markRunFinished(userId: string) {
  activeRunsByUser.set(userId, Math.max(0, (activeRunsByUser.get(userId) || 1) - 1));
}

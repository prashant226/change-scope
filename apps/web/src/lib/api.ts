import type { AnalyzedChange, AgentLogEntry, MonitorRecord, RunRecord } from "../types/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  startRun: (url: string) =>
    request<{ runId: string; monitorId: string; alreadyMonitored: boolean }>("/runs", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  runMonitor: (monitorId: string) =>
    request<{ runId: string }>(`/monitors/${monitorId}/run`, { method: "POST" }),
  getRun: (runId: string) => request<{ run: RunRecord }>(`/runs/${runId}`),
  getLogs: (runId: string) => request<{ logs: AgentLogEntry[] }>(`/runs/${runId}/logs`),
  getChanges: (runId: string) =>
    request<{ meaningful: AnalyzedChange[]; cosmetic: AnalyzedChange[] }>(`/runs/${runId}/changes`),
  listMonitors: () => request<{ monitors: MonitorRecord[] }>("/monitors"),
  getMonitor: (id: string) => request<{ monitor: MonitorRecord }>(`/monitors/${id}`),
  getHistory: (id: string) => request<{ snapshots: unknown[]; runs: RunRecord[] }>(`/monitors/${id}/history`),
  getAnalytics: () => request<Record<string, unknown>>("/analytics"),
};

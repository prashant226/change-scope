import type {
  AnalyzedChange,
  AgentLogEntry,
  AnalyticsSummary,
  MonitorRecord,
  RunRecord,
  SnapshotSummary,
} from "../types/api";
import { supabase } from "./supabaseClient";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`/api${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  startRun: (url: string) =>
    request<{ runId: string; monitorId: string; alreadyMonitored: boolean }>("/runs", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  createMonitor: (url: string, scheduleFrequency: string) =>
    request<{ monitor: MonitorRecord; alreadyMonitored: boolean }>("/monitors", {
      method: "POST",
      body: JSON.stringify({ url, scheduleFrequency }),
    }),
  runMonitor: (monitorId: string) =>
    request<{ runId: string }>(`/monitors/${monitorId}/run`, { method: "POST" }),
  updateMonitor: (monitorId: string, patch: Partial<MonitorRecord>) =>
    request<{ monitor: MonitorRecord }>(`/monitors/${monitorId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteMonitor: (monitorId: string) => request<void>(`/monitors/${monitorId}`, { method: "DELETE" }),
  getRun: (runId: string) => request<{ run: RunRecord }>(`/runs/${runId}`),
  getLogs: (runId: string) => request<{ logs: AgentLogEntry[] }>(`/runs/${runId}/logs`),
  getChanges: (runId: string) =>
    request<{ meaningful: AnalyzedChange[]; cosmetic: AnalyzedChange[] }>(`/runs/${runId}/changes`),
  listMonitors: () => request<{ monitors: MonitorRecord[] }>("/monitors"),
  getMonitor: (id: string) => request<{ monitor: MonitorRecord }>(`/monitors/${id}`),
  getHistory: (id: string) =>
    request<{ snapshots: SnapshotSummary[]; runs: RunRecord[] }>(`/monitors/${id}/history`),
  getAnalytics: () => request<AnalyticsSummary>("/analytics"),
};

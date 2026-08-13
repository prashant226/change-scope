import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { AgentLogEntry, AnalyzedChange, RunRecord } from "../types/api";

/**
 * Polls a run until it finishes. Realtime (Supabase channel) can replace this
 * poll later without changing the component contract (§64 — polling is the
 * required fallback anyway).
 */
export function useRun(runId: string | null) {
  const [run, setRun] = useState<RunRecord | null>(null);
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [changes, setChanges] = useState<{ meaningful: AnalyzedChange[]; cosmetic: AnalyzedChange[] } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!runId) return;
    setRun(null);
    setLogs([]);
    setChanges(null);

    const poll = async () => {
      try {
        const [{ run: r }, { logs: l }] = await Promise.all([api.getRun(runId), api.getLogs(runId)]);
        setRun(r);
        setLogs(l);
        if (r.status === "completed" || r.status === "partial" || r.status === "failed") {
          if (timer.current) clearInterval(timer.current);
          if (r.status !== "failed") {
            const c = await api.getChanges(runId);
            setChanges(c);
          }
        }
      } catch (err) {
        console.error("Polling failed:", err);
      }
    };

    poll();
    timer.current = setInterval(poll, 1200);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [runId]);

  return { run, logs, changes };
}

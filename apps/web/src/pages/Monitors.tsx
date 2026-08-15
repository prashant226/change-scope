import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ListChecks, Plus } from "lucide-react";
import { api } from "../lib/api";
import type { MonitorRecord } from "../types/api";
import { MonitorStatusBadge } from "../components/StatusBadge";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { relativeTime, formatDateTime } from "../lib/format";
import { CreateMonitorModal } from "../components/CreateMonitorModal";

/** The "Changes" column: dash before there's a comparison to speak of. The
 * column header already says "Changes", so a nonzero count is shown bare
 * (1, 2, …) rather than repeating the word. */
function changesLabel(m: MonitorRecord): string {
  if (m.latestReportType !== "comparison") return "—";
  const count = m.latestMeaningfulChangeCount ?? 0;
  return count === 0 ? "No changes" : String(count);
}

export function Monitors() {
  const [monitors, setMonitors] = useState<MonitorRecord[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    api.listMonitors().then((r) => setMonitors(r.monitors));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto py-10 px-6">
      <PageHeader
        title="Monitors"
        subtitle="What webpages are you monitoring?"
        action={
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            Monitor URL
          </button>
        }
      />

      <div className="card overflow-x-auto">
        {monitors?.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No monitors yet"
            description='Click "Monitor URL" to add your first webpage and start tracking what changes.'
            action={
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                Monitor URL
              </button>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Page</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last run</th>
                <th className="px-5 py-3">Changes</th>
                <th className="px-5 py-3">Next check</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {monitors?.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-soft/70 transition-colors">
                  <td className="px-5 py-3.5">
                    <button onClick={() => navigate(`/monitors/${m.id}`)} className="text-left">
                      <div className="font-medium text-ink">{m.title || m.url}</div>
                      <div className="text-xs text-muted truncate max-w-xs">{m.url}</div>
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <span title={m.derivedStatus === "pending" ? "This monitor has been added but has not completed its first successful scan." : undefined}>
                      <MonitorStatusBadge status={m.derivedStatus || "pending"} />
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-ink">
                    {m.derivedStatus === "pending" ? "Never" : relativeTime(m.latestRunCompletedAt || m.lastRunAt)}
                  </td>
                  <td className="px-5 py-3.5 text-ink">{changesLabel(m)}</td>
                  <td className="px-5 py-3.5 text-muted">
                    {m.schedulingEnabled ? formatDateTime(m.nextRunAt) : "Not scheduled"}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => navigate(`/monitors/${m.id}`)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateMonitorModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

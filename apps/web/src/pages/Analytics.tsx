import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import type { AnalyticsSummary } from "../types/api";
import { PageHeader } from "../components/PageHeader";

// Fixed-order categorical slots (first 5 of the validated 8-hue theme) — used only
// for "changes by type", where category identity (not status) is what's encoded.
const TYPE_COLORS: Record<string, string> = {
  content: "#2a78d6",
  structural: "#eb6834",
  functional: "#1baf7a",
  visual: "#eda100",
  media: "#e87ba4",
  metadata: "#4a3aa7",
};

// Status colors — same tokens used for High/Medium/Low badges elsewhere in the app.
const IMPACT_COLORS: Record<string, string> = {
  high: "#DC2626",
  medium: "#D97706",
  low: "#16A34A",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">{label}</p>
      <p className="text-[28px] font-semibold text-ink tracking-tight">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-ink mb-4">{title}</h2>
      <div className="h-56">{children}</div>
    </div>
  );
}

export function Analytics() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    api.getAnalytics().then(setData);
  }, []);

  if (!data) return <div className="max-w-5xl mx-auto py-10 px-6 text-muted">Loading…</div>;

  const typeData = Object.entries(data.changesByType).map(([type, count]) => ({ type, count }));
  const impactData = (["high", "medium", "low"] as const).map((impact) => ({
    impact: impact.charAt(0).toUpperCase() + impact.slice(1),
    count: data.changesByImpact[impact],
    key: impact,
  }));

  return (
    <div className="max-w-5xl mx-auto py-10 px-6">
      <PageHeader title="Analytics" subtitle="What is changing, where, and how often?" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Monitors" value={data.monitorCount} />
        <StatCard label="Meaningful changes" value={data.meaningfulChangeCount} />
        <StatCard label="High-impact changes" value={data.highImpactChangeCount} />
        <StatCard label="Avg. changes / monitor" value={data.avgChangesPerMonitor} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Meaningful changes over time">
          {data.changesOverTime.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.changesOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={{ stroke: "#E5E7EB" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#E5E7EB" }} />
                <Bar dataKey="count" name="Changes" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Changes by type">
          {typeData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="type" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={{ stroke: "#E5E7EB" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#E5E7EB" }} />
                <Bar dataKey="count" name="Changes" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {typeData.map((d) => (
                    <Cell key={d.type} fill={TYPE_COLORS[d.type] || "#64748B"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Changes by impact">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={impactData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="impact" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={{ stroke: "#E5E7EB" }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#E5E7EB" }} />
              <Bar dataKey="count" name="Changes" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {impactData.map((d) => (
                  <Cell key={d.key} fill={IMPACT_COLORS[d.key]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Most changed monitors</h2>
          {data.mostChangedMonitors.length === 0 ? (
            <p className="text-sm text-muted">No changes recorded yet.</p>
          ) : (
            <ol className="space-y-2.5">
              {data.mostChangedMonitors.map((m, i) => (
                <li key={m.monitorId} className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-ink min-w-0 truncate">
                    {i + 1}. {m.title}
                  </span>
                  <span className="text-muted shrink-0">{m.changeCount} change(s)</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return <div className="h-full flex items-center justify-center text-sm text-muted">No data yet</div>;
}

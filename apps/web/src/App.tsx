import { Activity, BarChart3, History, LayoutGrid, Settings } from "lucide-react";
import { Overview } from "./pages/Overview";

const NAV_ITEMS = [
  { label: "Overview", icon: LayoutGrid, active: true },
  { label: "Monitors", icon: LayoutGrid, active: false },
  { label: "History", icon: History, active: false },
  { label: "Analytics", icon: BarChart3, active: false },
];

export default function App() {
  return (
    <div className="flex min-h-screen bg-soft">
      <aside className="w-56 shrink-0 border-r border-border bg-white flex flex-col">
        <div className="px-5 py-5">
          <span className="text-lg font-semibold text-ink">ChangeScope</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map(({ label, icon: Icon, active }) => (
            <div
              key={label}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                active ? "bg-blue-50 text-primary" : "text-muted"
              }`}
              title={active ? undefined : "Coming soon"}
            >
              <Icon className="h-4 w-4" />
              {label}
            </div>
          ))}
          <div className="my-3 border-t border-border" />
          <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted">
            <Activity className="h-4 w-4" />
            Activity
          </div>
        </nav>
        <div className="px-3 pb-4">
          <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted">
            <Settings className="h-4 w-4" />
            Settings
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Overview />
      </main>
    </div>
  );
}

import { NavLink, useNavigate } from "react-router-dom";
import { Activity, BarChart3, History, LayoutGrid, ListChecks, LogOut, Radar, Settings } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/monitors", label: "Monitors", icon: ListChecks, end: false },
  { to: "/history", label: "History", icon: History, end: false },
  { to: "/analytics", label: "Analytics", icon: BarChart3, end: false },
];

function navClass(active: boolean) {
  return `group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    active ? "bg-primary-light text-primary" : "text-muted hover:bg-soft hover:text-ink"
  }`;
}

function initials(email: string): string {
  const name = email.split("@")[0];
  return name.slice(0, 2).toUpperCase();
}

export function Sidebar() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-white flex flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
          <Radar className="h-4.5 w-4.5 text-white" strokeWidth={2.25} />
        </div>
        <span className="text-[15px] font-semibold text-ink tracking-tight">ChangeScope</span>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => navClass(isActive)}>
            <Icon className="h-4 w-4" strokeWidth={2} />
            {label}
          </NavLink>
        ))}

        <div className="my-3 border-t border-border" />
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted/70">Activity</p>
        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted">
          <Activity className="h-4 w-4" strokeWidth={2} />
          Agent runs
        </div>
      </nav>

      <div className="px-3 pb-4 border-t border-border pt-3">
        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted">
          <Settings className="h-4 w-4" strokeWidth={2} />
          Settings
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-soft hover:text-ink"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
          Sign out
        </button>

        {session?.user?.email && (
          <div className="mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-light text-[11px] font-semibold text-primary">
              {initials(session.user.email)}
            </div>
            <p className="truncate text-xs text-muted" title={session.user.email}>
              {session.user.email}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

import { NavLink, useNavigate } from "react-router-dom";
import { Activity, BarChart3, History, LayoutGrid, ListChecks, LogOut, Settings } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/monitors", label: "Monitors", icon: ListChecks, end: false },
  { to: "/history", label: "History", icon: History, end: false },
  { to: "/analytics", label: "Analytics", icon: BarChart3, end: false },
];

function navClass(active: boolean) {
  return `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
    active ? "bg-blue-50 text-primary" : "text-muted hover:bg-soft hover:text-ink"
  }`;
}

export function Sidebar() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-white flex flex-col">
      <div className="px-5 py-5">
        <span className="text-lg font-semibold text-ink">ChangeScope</span>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => navClass(isActive)}>
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
        <div className="my-3 border-t border-border" />
        <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted">
          <Activity className="h-4 w-4" />
          Activity
        </div>
      </nav>
      <div className="px-3 pb-4 border-t border-border pt-3">
        {session?.user?.email && (
          <p className="px-3 text-xs text-muted truncate mb-1" title={session.user.email}>
            {session.user.email}
          </p>
        )}
        <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted">
          <Settings className="h-4 w-4" />
          Settings
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-soft hover:text-ink"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

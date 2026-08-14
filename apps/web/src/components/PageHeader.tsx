import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="text-[26px] font-semibold text-ink tracking-tight">{title}</h1>
        {subtitle && <p className="text-[15px] text-muted mt-1.5">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

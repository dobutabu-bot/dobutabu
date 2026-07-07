import { Children, type ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";

type PanelProps = {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
};

export function Panel({ title, icon, action, children }: PanelProps) {
  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100/80 bg-white/52 px-4 py-3 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.15)]">
              {icon}
            </span>
          ) : null}
          <h2 className="truncate text-sm font-semibold text-slate-950">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

export function StackedList({ children, empty }: { children: ReactNode; empty: string }) {
  const items = Children.toArray(children).filter(Boolean);

  if (items.length === 0) {
    return <EmptyState title={empty} />;
  }

  return <div className="divide-y divide-slate-100">{items}</div>;
}

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MobileRecordCardProps = {
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function MobileRecordCard({ title, meta, children, actions, className }: MobileRecordCardProps) {
  return (
    <article className={cn("v4-mobile-record-card", className)}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-950">{title}</div>
          {meta ? <div className="mt-1 text-xs text-slate-500">{meta}</div> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children ? <div className="mt-3 min-w-0 text-sm text-slate-700">{children}</div> : null}
    </article>
  );
}

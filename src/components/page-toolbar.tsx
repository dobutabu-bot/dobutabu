import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageToolbarProps = {
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageToolbar({ filters, actions, className }: PageToolbarProps) {
  return (
    <section className={cn("v4-page-toolbar", className)}>
      {filters ? <div className="min-w-0 flex-1">{filters}</div> : null}
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}

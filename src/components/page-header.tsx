import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <section className={cn("v4-page-header", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="v4-page-eyebrow">{eyebrow}</p> : null}
        <h1 className="v4-page-title">{title}</h1>
        {description ? <p className="v4-page-description">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </section>
  );
}

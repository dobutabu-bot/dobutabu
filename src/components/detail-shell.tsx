import Link from "@/components/app-link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type DetailBreadcrumbProps = {
  items: BreadcrumbItem[];
};

type DetailHeroProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
};

type DetailTabsProps = {
  tabs?: Array<{ href: string; label: string }>;
};

type DetailSectionProps = {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export const defaultDetailTabs = [
  { href: "#overview", label: "Genel Bakış" },
  { href: "#finance", label: "Finans" },
  { href: "#documents", label: "Belgeler" },
  { href: "#activity", label: "İşlem Geçmişi" }
];

export function DetailBreadcrumb({ items }: DetailBreadcrumbProps) {
  return (
    <nav className="scroll-x-stable" aria-label="Breadcrumb">
      <ol className="flex min-w-max items-center gap-2 text-sm text-slate-500">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? <span className="text-slate-300">/</span> : null}
              {item.href && !current ? (
                <Link href={item.href} className="font-medium text-slate-600 hover:text-slate-950">
                  {item.label}
                </Link>
              ) : (
                <span className={current ? "font-semibold text-slate-950" : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function DetailHero({ eyebrow, title, description, status, actions }: DetailHeroProps) {
  return (
    <section className="surface-dark p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">{eyebrow}</p> : null}
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
            {status}
          </div>
          {description ? <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">{actions}</div> : null}
      </div>
    </section>
  );
}

export function DetailTabs({ tabs = defaultDetailTabs }: DetailTabsProps) {
  return (
    <nav className="surface scroll-x-stable p-2" aria-label="Detay bölümleri">
      <div className="flex min-w-max gap-2">
        {tabs.map((tab) => (
          <a
            key={tab.href}
            href={tab.href}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-slate-950"
          >
            {tab.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function DetailSection({ id, title, description, actions, children, className }: DetailSectionProps) {
  return (
    <section id={id} className={cn("surface scroll-mt-24 p-4", className)}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function DetailInfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <dt className="text-xs font-medium uppercase tracking-normal text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-slate-800">{value || "-"}</dd>
    </div>
  );
}

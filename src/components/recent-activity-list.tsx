import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";

export type RecentActivityItem = {
  id: string;
  title: string;
  description: string;
  meta: string;
  value?: string;
  tone?: "green" | "rose" | "amber" | "neutral";
  badge?: string;
};

type RecentActivityListProps = {
  items: RecentActivityItem[];
  empty: string;
  scrollable?: boolean;
  maxHeightClassName?: string;
};

export function RecentActivityList({
  items,
  empty,
  scrollable = false,
  maxHeightClassName = "activity-scroll-frame"
}: RecentActivityListProps) {
  if (items.length === 0) {
    return <EmptyState title={empty} />;
  }

  return (
    <div className={cn("divide-y divide-slate-100", scrollable && ["scroll-y-stable pr-1", maxHeightClassName])}>
      {items.map((item) => (
        <div key={item.id} className="flex items-start justify-between gap-3 px-2 py-3 sm:px-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {item.badge ? <StatusBadge tone={badgeTone(item.tone)}>{item.badge}</StatusBadge> : null}
              <p className="truncate text-sm font-medium text-slate-950">{item.title}</p>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">{item.description}</p>
          </div>
          <div className="shrink-0 text-right">
            {item.value ? <p className={cn("text-sm font-semibold tabular-finance", valueToneClass(item.tone))}>{item.value}</p> : null}
            <p className={cn("text-xs text-slate-500", item.value && "mt-1")}>{item.meta}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function badgeTone(tone: RecentActivityItem["tone"]) {
  if (tone === "green") return "green";
  if (tone === "rose") return "rose";
  if (tone === "amber") return "amber";
  return "neutral";
}

function valueToneClass(tone: RecentActivityItem["tone"]) {
  if (tone === "green") return "text-emerald-700";
  if (tone === "rose") return "text-rose-700";
  if (tone === "amber") return "text-amber-700";
  return "text-slate-950";
}

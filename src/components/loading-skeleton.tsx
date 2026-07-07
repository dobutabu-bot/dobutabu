import { cn } from "@/lib/utils";

type LoadingSkeletonProps = {
  className?: string;
  rows?: number;
};

export function LoadingSkeleton({ className, rows = 1 }: LoadingSkeletonProps) {
  if (rows <= 1) {
    return <div className={cn("h-4 animate-pulse rounded-full bg-slate-200/80", className)} aria-hidden />;
  }

  return (
    <div className={cn("space-y-3", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-4 animate-pulse rounded-full bg-slate-200/80" />
      ))}
    </div>
  );
}

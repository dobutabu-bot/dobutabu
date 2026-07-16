import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function TopBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header className={cn("sticky top-0 z-20 min-h-[var(--v4-header-height)] border-b border-white/60 bg-white/70 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] shadow-[0_14px_42px_rgba(15,23,42,0.06)] backdrop-blur-2xl lg:px-8 lg:pt-3", className)}>
      {children}
    </header>
  );
}

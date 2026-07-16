import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Sidebar({ children, className }: { children: ReactNode; className?: string }) {
  return <aside className={cn("app-sidebar fixed inset-y-0 left-0 z-40 hidden w-[5.5rem] overflow-visible px-3 py-4 text-white lg:flex lg:flex-col", className)}>{children}</aside>;
}

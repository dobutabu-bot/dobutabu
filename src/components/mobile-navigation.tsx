import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type MobileNavigationProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export function MobileNavigation({ children, className, ...props }: MobileNavigationProps) {
  return (
    <nav
      className={cn("fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/70 bg-white/85 pb-[env(safe-area-inset-bottom)] shadow-[0_-18px_42px_rgba(15,23,42,0.12)] backdrop-blur-2xl lg:hidden", className)}
      {...props}
    >
      {children}
    </nav>
  );
}

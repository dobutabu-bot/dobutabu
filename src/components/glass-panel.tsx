import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type GlassPanelProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
};

export function GlassPanel({ children, className, as: Component = "section" }: GlassPanelProps) {
  return <Component className={cn("glass-panel", className)}>{children}</Component>;
}

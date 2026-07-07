import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PremiumCardProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
  hover?: boolean;
};

export function PremiumCard({ children, className, as: Component = "div", hover = true }: PremiumCardProps) {
  return <Component className={cn("premium-card", hover && "premium-card-hover", className)}>{children}</Component>;
}

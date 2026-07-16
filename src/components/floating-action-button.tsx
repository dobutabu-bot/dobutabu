import type { LucideIcon } from "lucide-react";
import Link from "@/components/app-link";

import { cn } from "@/lib/utils";

type FloatingActionButtonProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  className?: string;
};

export function FloatingActionButton({ href, label, icon: Icon, className }: FloatingActionButtonProps) {
  return (
    <Link href={href} className={cn("floating-action-button", className)} aria-label={label}>
      <Icon className="h-5 w-5" aria-hidden />
    </Link>
  );
}

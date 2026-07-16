import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type SearchFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function SearchField({ label = "Arama", className, ...props }: SearchFieldProps) {
  return (
    <label className="block min-w-0 space-y-1">
      <span className="label">{label}</span>
      <span className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input className={cn("field pl-10", className)} type="search" {...props} />
      </span>
    </label>
  );
}

import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

type PrivacyAmountProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
};

export function PrivacyAmount({ children, className, as: Component = "span" }: PrivacyAmountProps) {
  return <Component className={cn("privacy-amount", className)}>{children}</Component>;
}

export function PrivacyDocumentFrame({ children }: { children: ReactNode }) {
  return (
    <div className="privacy-document-preview relative overflow-hidden">
      <div className="privacy-document-content">{children}</div>
      <div className="privacy-document-overlay pointer-events-none absolute inset-0 z-10 hidden items-center justify-center bg-slate-950/45 p-6 text-center backdrop-blur-xl">
        <div className="rounded-3xl border border-white/15 bg-slate-950/80 px-5 py-4 text-white shadow-2xl">
          <p className="text-sm font-semibold">Gizlilik modu açık</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">Belge önizlemesi ekran paylaşımı için bulanıklaştırıldı.</p>
        </div>
      </div>
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonTone = "dark" | "light" | "green" | "rose";

const toneClasses: Record<ButtonTone, string> = {
  dark: "text-white shadow-[0_14px_30px_rgba(15,23,42,0.20)] [background:linear-gradient(135deg,#07101e_0%,#0b1728_58%,#020617_100%)] hover:brightness-110",
  light: "border border-white/70 bg-white/80 text-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.07)] hover:bg-white",
  green: "bg-emerald-600 text-white shadow-[0_14px_30px_rgba(4,120,87,0.22)] hover:bg-emerald-700",
  rose: "bg-rose-600 text-white shadow-[0_14px_30px_rgba(190,18,60,0.22)] hover:bg-rose-700"
};

type CommonProps = {
  icon?: LucideIcon;
  tone?: ButtonTone;
  className?: string;
  children: React.ReactNode;
};

type AppleLikeButtonProps =
  | (CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined })
  | (CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string });

export function AppleLikeButton({ icon: Icon, tone = "dark", className, children, href, ...props }: AppleLikeButtonProps) {
  const content = (
    <>
      {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </>
  );
  const classes = cn("apple-button", toneClasses[tone], className);

  if (href) {
    return (
      <Link href={href} className={classes} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </Link>
    );
  }

  return (
    <button className={classes} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {content}
    </button>
  );
}

import type { CashLedgerDirection, CashLedgerEntryType } from "@prisma/client";
import { ArrowDownLeft, ArrowUpRight, MoveHorizontal } from "lucide-react";

import { AmountText } from "@/components/amount-text";
import { PremiumCard } from "@/components/premium-card";
import { StatusPill } from "@/components/status-pill";
import { cn, formatMoney, toNumber } from "@/lib/utils";

type CashMovementRowProps = {
  title: string;
  date: string;
  amount: unknown;
  currency?: string;
  direction: CashLedgerDirection;
  entryType: CashLedgerEntryType;
  accountName: string;
  entryTypeLabel: string;
  directionLabel: string;
  clientName?: string;
  caseFileTitle?: string;
  description?: string;
  className?: string;
};

export function CashMovementRow({
  title,
  date,
  amount,
  currency = "TRY",
  direction,
  entryType,
  accountName,
  entryTypeLabel,
  directionLabel,
  clientName,
  caseFileTitle,
  description,
  className
}: CashMovementRowProps) {
  const movementTone = movementToneFor(entryType, direction);
  const signedAmount = direction === "IN" ? toNumber(amount) : -toNumber(amount);
  const Icon = entryType === "TRANSFER" ? MoveHorizontal : direction === "IN" ? ArrowUpRight : ArrowDownLeft;
  const context = [accountName, clientName, caseFileTitle].filter(Boolean).join(" · ");

  return (
    <PremiumCard as="article" className={cn("p-4", movementBorderClass(movementTone), className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", movementIconClass(movementTone))}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={movementTone}>{entryType === "TRANSFER" ? entryTypeLabel : directionLabel}</StatusPill>
              <p className="text-xs font-medium text-slate-500">{date}</p>
            </div>
            <h3 className="mt-1 truncate text-sm font-semibold text-slate-950">{title}</h3>
            {description ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{description}</p> : null}
            {context ? <p className="mt-1 truncate text-xs text-slate-500">{context}</p> : null}
          </div>
        </div>
        <p className="shrink-0 text-right">
          {entryType === "TRANSFER" ? (
            <span className="tabular-finance text-sm font-semibold text-blue-700">{formatSignedTransferAmount(signedAmount, currency)}</span>
          ) : (
            <AmountText value={signedAmount} currency={currency} size="sm" variant="strong" />
          )}
        </p>
      </div>
    </PremiumCard>
  );
}

function movementToneFor(entryType: CashLedgerEntryType, direction: CashLedgerDirection) {
  if (entryType === "TRANSFER") {
    return "blue" as const;
  }

  return direction === "IN" ? ("green" as const) : ("rose" as const);
}

function movementIconClass(tone: "green" | "rose" | "blue") {
  return {
    green: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
    rose: "bg-rose-50 text-rose-800 ring-1 ring-rose-200",
    blue: "bg-blue-50 text-blue-800 ring-1 ring-blue-200"
  }[tone];
}

function movementBorderClass(tone: "green" | "rose" | "blue") {
  return {
    green: "border-emerald-200/80",
    rose: "border-rose-200/80",
    blue: "border-blue-200/80"
  }[tone];
}

function formatSignedTransferAmount(value: number, currency: string) {
  if (value === 0) {
    return formatMoney(0, currency);
  }

  const sign = value > 0 ? "+" : "-";
  return `${sign}${formatMoney(Math.abs(value), currency)}`;
}

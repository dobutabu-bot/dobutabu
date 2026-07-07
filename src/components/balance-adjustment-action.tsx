"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatMoney } from "@/lib/utils";

type BalanceAdjustmentActionProps = {
  cashAccountId: string | null;
  difference: number;
  currency: string;
  currentDate: string;
};

export function BalanceAdjustmentAction({ cashAccountId, difference, currency, currentDate }: BalanceAdjustmentActionProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const absoluteDifference = Math.abs(difference);
  const disabled = !cashAccountId || absoluteDifference < 0.01 || pending;

  async function createAdjustment() {
    if (!cashAccountId || absoluteDifference < 0.01) return;

    const direction = difference > 0 ? "IN" : "OUT";
    const confirmed = window.confirm(
      `${formatMoney(absoluteDifference, currency)} tutarında ${direction === "IN" ? "pozitif" : "negatif"} kasa düzeltmesi oluşturulsun mu? Bu işlem audit log'a kaydedilir.`
    );

    if (!confirmed) return;

    setPending(true);
    try {
      const response = await fetch("/api/cash/ledger/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashAccountId,
          direction,
          amount: absoluteDifference.toFixed(2),
          currency,
          date: currentDate,
          description: "Banka mutabakat farkı düzeltmesi",
          referenceNo: "BALANCE-RECONCILIATION",
          clientId: "",
          caseFileId: ""
        })
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        window.alert(result.message ?? "Kasa düzeltmesi oluşturulamadı.");
        return;
      }

      window.alert("Kasa düzeltmesi oluşturuldu.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" onClick={createAdjustment} disabled={disabled} className="primary-action min-h-11 disabled:cursor-not-allowed disabled:opacity-50">
      {pending ? "Oluşturuluyor..." : "Kasa düzeltmesi oluştur"}
    </button>
  );
}

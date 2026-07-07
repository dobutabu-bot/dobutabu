"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ActionButtonProps = {
  endpoint: string;
  payload: Record<string, unknown>;
  label: string;
  variant?: "default" | "danger" | "success";
};

type ManualOption = {
  id: string;
  date: string | null;
  description: string;
  amount: number;
  currency?: string;
  direction: "IN" | "OUT" | "NEUTRAL";
};

type SystemOption = {
  id: string;
  date: string;
  description: string;
  amount: number;
  direction: "IN" | "OUT";
  entryType: string;
};

export function ReconciliationActionButton({ endpoint, payload, label, variant = "default" }: ActionButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function runAction() {
    setPending(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        window.alert(result.message ?? "İşlem tamamlanamadı.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" onClick={runAction} disabled={pending} className={buttonClass(variant)}>
      {pending ? "İşleniyor..." : label}
    </button>
  );
}

export function AutoMatchButton() {
  return (
    <a href="#match-suggestions" className="primary-action min-h-11">
      Otomatik eşleştir
    </a>
  );
}

export function ManualReconciliationForm({
  bankRows,
  systemMovements
}: {
  bankRows: ManualOption[];
  systemMovements: SystemOption[];
}) {
  const router = useRouter();
  const [bankRowId, setBankRowId] = useState(bankRows[0]?.id ?? "");
  const [systemEntryId, setSystemEntryId] = useState(systemMovements[0]?.id ?? "");
  const [pending, setPending] = useState(false);

  async function submitManualMatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bankRowId || !systemEntryId) return;
    setPending(true);
    try {
      const response = await fetch("/api/reconciliation/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankRowId, targetType: "LEDGER", targetId: systemEntryId, matchMode: "MANUALLY_MATCHED" })
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        window.alert(result.message ?? "Manuel eşleştirme tamamlanamadı.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (bankRows.length === 0 || systemMovements.length === 0) {
    return <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Manuel eşleştirme için uygun hareket bulunamadı.</p>;
  }

  return (
    <form onSubmit={submitManualMatch} className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-slate-600">Banka hareketi seç</span>
        <select value={bankRowId} onChange={(event) => setBankRowId(event.target.value)} className="input min-h-11">
          {bankRows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.date ?? "-"} · {row.direction} · {row.amount.toLocaleString("tr-TR")} · {row.description.slice(0, 80)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-slate-600">Sistem hareketi seç</span>
        <select value={systemEntryId} onChange={(event) => setSystemEntryId(event.target.value)} className="input min-h-11">
          {systemMovements.map((row) => (
            <option key={row.id} value={row.id}>
              {row.date} · {row.direction} · {row.amount.toLocaleString("tr-TR")} · {row.description.slice(0, 80)}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="primary-action min-h-11 self-end">
        {pending ? "Eşleştiriliyor..." : "Eşleştir"}
      </button>
    </form>
  );
}

function buttonClass(variant: ActionButtonProps["variant"]) {
  if (variant === "danger") return "danger-action min-h-9 px-2 text-xs";
  if (variant === "success") return "primary-action min-h-9 px-2 text-xs";
  return "secondary-action min-h-9 px-2 text-xs";
}

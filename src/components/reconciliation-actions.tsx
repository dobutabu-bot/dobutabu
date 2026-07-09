"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { TouchActionButton, touchActionButtonClass } from "@/components/touch-action-button";

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
    <TouchActionButton onClick={runAction} disabled={pending} tone={buttonTone(variant)}>
      {pending ? "İşleniyor..." : label}
    </TouchActionButton>
  );
}

export function AutoMatchButton() {
  return (
    <a href="#match-suggestions" className={touchActionButtonClass("primary")}>
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
    <form onSubmit={submitManualMatch} className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <label className="grid min-w-0 gap-1 text-sm">
        <span className="text-xs font-medium text-slate-600">Banka hareketi seç</span>
        <select value={bankRowId} onChange={(event) => setBankRowId(event.target.value)} className="input min-h-11 w-full min-w-0">
          {bankRows.map((row) => (
            <option key={row.id} value={row.id}>
              {formatManualOptionLabel(row)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-sm">
        <span className="text-xs font-medium text-slate-600">Sistem hareketi seç</span>
        <select value={systemEntryId} onChange={(event) => setSystemEntryId(event.target.value)} className="input min-h-11 w-full min-w-0">
          {systemMovements.map((row) => (
            <option key={row.id} value={row.id}>
              {formatSystemOptionLabel(row)}
            </option>
          ))}
        </select>
      </label>
      <TouchActionButton type="submit" disabled={pending} tone="primary" className="w-full self-end lg:w-auto">
        {pending ? "Eşleştiriliyor..." : "Eşleştir"}
      </TouchActionButton>
    </form>
  );
}

function formatManualOptionLabel(row: ManualOption) {
  return `${row.date ?? "-"} · ${row.direction} · ${row.amount.toLocaleString("tr-TR")} · ${truncateOptionText(row.description)}`;
}

function formatSystemOptionLabel(row: SystemOption) {
  return `${row.date} · ${row.direction} · ${row.amount.toLocaleString("tr-TR")} · ${truncateOptionText(row.description)}`;
}

function truncateOptionText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}

function buttonTone(variant: ActionButtonProps["variant"]) {
  if (variant === "danger") return "danger";
  if (variant === "success") return "primary";
  return "default";
}

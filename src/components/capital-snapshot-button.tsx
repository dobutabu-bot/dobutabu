"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { showToast } from "@/components/toast";

export function CapitalSnapshotButton({ currency = "TRY" }: { currency?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function createSnapshot() {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(`/api/capital/snapshots?currency=${encodeURIComponent(currency)}`, { method: "POST" });
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        window.alert(result.message ?? "Sermaye anlık görüntüsü oluşturulamadı.");
        return;
      }
      showToast("Sermaye anlık görüntüsü oluşturuldu.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" onClick={createSnapshot} disabled={pending} className="primary-action min-h-11 disabled:cursor-not-allowed disabled:opacity-60">
      <Camera className="h-4 w-4" aria-hidden />
      {pending ? "Kaydediliyor..." : "Snapshot al"}
    </button>
  );
}

"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { showToast } from "@/components/toast";
import { emitAppDataMutation } from "@/lib/client-sync";

type DocumentReprocessButtonProps = {
  documentId: string;
};

export function DocumentReprocessButton({ documentId }: DocumentReprocessButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function reprocessDocument() {
    if (loading) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/reprocess`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { message?: string; extractionStatus?: string } | null;

      if (!response.ok) {
        showToast(payload?.message || "Belge yeniden işleme alınamadı.");
        return;
      }

      showToast(payload?.message || "Belge yeniden işlendi.");
      emitAppDataMutation("document-reprocess");
      router.refresh();
    } catch {
      showToast("Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className="secondary-action" disabled={loading} onClick={reprocessDocument}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
      Yeniden İşle
    </button>
  );
}

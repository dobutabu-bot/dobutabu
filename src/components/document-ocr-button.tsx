"use client";

import { FileSearch, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { showToast } from "@/components/toast";
import { emitAppDataMutation } from "@/lib/client-sync";

type DocumentOcrButtonProps = {
  documentId: string;
};

export function DocumentOcrButton({ documentId }: DocumentOcrButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function startOcr() {
    if (loading) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/ocr`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        showToast(payload?.message || "OCR işlemi başlatılamadı.");
        return;
      }

      showToast(payload?.message || "OCR işi kuyruğa alındı.");
      emitAppDataMutation("document-ocr");
      router.refresh();
    } catch {
      showToast("Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className="secondary-action" disabled={loading} onClick={startOcr}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileSearch className="h-4 w-4" aria-hidden />}
      OCR Başlat
    </button>
  );
}

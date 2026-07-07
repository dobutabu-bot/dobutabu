"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionButton } from "@/components/action-buttons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { showToast } from "@/components/toast";
import { emitAppDataMutation } from "@/lib/client-sync";

type RestoreRecordButtonProps = {
  endpoint: string;
  title?: string;
  description?: string;
};

export function RestoreRecordButton({
  endpoint,
  title = "Kayıt geri alınsın mı?",
  description = "Bu kayıt normal listelerde tekrar görünür hale getirilecek."
}: RestoreRecordButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function restoreRecord() {
    if (loading) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(endpoint, { method: "POST" });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setMessage(payload?.message || "Kayıt geri alınamadı. Lütfen tekrar deneyin.");
        return;
      }

      showToast("Kayıt geri alındı.");
      setOpen(false);
      emitAppDataMutation("restore-record");
      router.refresh();
    } catch {
      setMessage("Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ActionButton label="Geri Al" icon={RotateCcw} tone="neutral" onClick={() => setOpen(true)} />
      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel="Geri Al"
        tone="neutral"
        loading={loading}
        error={message}
        confirmIcon={RotateCcw}
        onConfirm={restoreRecord}
        onOpenChange={setOpen}
      />
    </>
  );
}

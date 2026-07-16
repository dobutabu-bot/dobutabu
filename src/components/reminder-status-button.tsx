"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionButton } from "@/components/action-buttons";
import { showToast } from "@/components/toast";
import { apiRequest, clientErrorMessage } from "@/lib/client-api";
import { emitAppDataMutation } from "@/lib/client-sync";

type ReminderStatusButtonProps = {
  endpoint: string;
  payload: Record<string, string>;
  nextStatus: "OPEN" | "DONE";
};

export function ReminderStatusButton({ endpoint, payload, nextStatus }: ReminderStatusButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const completed = nextStatus === "DONE";

  async function updateStatus() {
    if (loading) {
      return;
    }

    setLoading(true);

    try {
      await apiRequest(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, status: nextStatus })
      }, "Hatırlatma güncellenemedi.");

      showToast(completed ? "Hatırlatma tamamlandı." : "Hatırlatma yeniden açıldı.");
      emitAppDataMutation("reminder-status");
      router.refresh();
    } catch (error) {
      showToast(clientErrorMessage(error, "Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ActionButton
      label={loading ? "İşleniyor" : completed ? "Tamamla" : "Aç"}
      icon={completed ? CheckCircle2 : RotateCcw}
      tone={completed ? "primary" : "neutral"}
      disabled={loading}
      onClick={updateStatus}
    />
  );
}

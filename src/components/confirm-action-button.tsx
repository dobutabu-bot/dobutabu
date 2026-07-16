"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionButton } from "@/components/action-buttons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { queueToast, showToast } from "@/components/toast";
import { apiRequest, clientErrorMessage } from "@/lib/client-api";
import { emitAppDataMutation } from "@/lib/client-sync";

type ConfirmActionButtonProps = {
  endpoint: string;
  label?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  method?: "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  tone?: "danger" | "neutral";
  successMessage?: string;
  redirectTo?: string;
};

export function ConfirmActionButton({
  endpoint,
  label = "Sil",
  title,
  description,
  confirmLabel = "Onayla",
  method = "DELETE",
  tone = "danger",
  successMessage,
  redirectTo,
  body
}: ConfirmActionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runAction() {
    if (loading) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await apiRequest(
        endpoint,
        {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined
        },
        "İşlem tamamlanamadı. Lütfen tekrar deneyin."
      );

      if (successMessage) {
        showToast(successMessage);
        if (redirectTo) {
          queueToast(successMessage);
        }
      }

      setOpen(false);
      emitAppDataMutation("confirm-action");
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch (error) {
      setMessage(clientErrorMessage(error, "Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ActionButton label={label} icon={Trash2} tone={tone} onClick={() => setOpen(true)} />
      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        tone={tone}
        loading={loading}
        error={message}
        onConfirm={runAction}
        onOpenChange={setOpen}
      />
    </>
  );
}

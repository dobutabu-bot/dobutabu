"use client";

import { ConfirmActionButton } from "@/components/confirm-action-button";

type ClientArchiveButtonProps = {
  clientId: string;
  redirectTo?: string;
};

export function ClientArchiveButton({ clientId, redirectTo }: ClientArchiveButtonProps) {
  return (
    <ConfirmActionButton
      endpoint={`/api/clients/${clientId}/archive`}
      method="POST"
      label="Sil"
      title="Müvekkil silinsin mi?"
      description="Bu müvekkili silmek istediğinizden emin misiniz? Bu işlem müvekkili normal listelerden kaldırır."
      confirmLabel="Sil"
      successMessage="Müvekkil silindi."
      redirectTo={redirectTo}
      tone="danger"
    />
  );
}

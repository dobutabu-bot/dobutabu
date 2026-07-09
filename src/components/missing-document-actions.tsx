"use client";

import { FilePlus2, Link2, Loader2, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { showToast } from "@/components/toast";
import { emitAppDataMutation } from "@/lib/client-sync";
import type { DocumentLinkOption } from "@/lib/document-link-types";
import type { MissingDocumentRecord } from "@/lib/missing-documents";

type MissingDocumentActionsProps = {
  record: Pick<MissingDocumentRecord, "id" | "entityType" | "uploadHref">;
  documentOptions: DocumentLinkOption[];
};

export function MissingDocumentActions({ record, documentOptions }: MissingDocumentActionsProps) {
  const router = useRouter();
  const [selectedDocumentId, setSelectedDocumentId] = useState(documentOptions[0]?.id ?? "");
  const [loadingAction, setLoadingAction] = useState<"link" | "ignore" | null>(null);

  async function linkSelectedDocument() {
    if (!selectedDocumentId || loadingAction) return;

    setLoadingAction("link");
    try {
      const response = await fetch("/api/documents/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: selectedDocumentId,
          entityType: record.entityType,
          entityId: record.id
        })
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        showToast(payload?.message || "Belge bağlantısı kurulamadı.");
        return;
      }

      showToast("Belge bağlantısı kuruldu.");
      emitAppDataMutation("document-link");
      router.refresh();
    } catch {
      showToast("Belge bağlantısı sırasında sorun oluştu.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function markNotRequired() {
    if (loadingAction) return;

    setLoadingAction("ignore");
    try {
      const response = await fetch("/api/documents/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: record.entityType,
          entityId: record.id
        })
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        showToast(payload?.message || "Belge gereksinimi güncellenemedi.");
        return;
      }

      showToast("Kayıt belge gerekmiyor olarak işaretlendi.");
      emitAppDataMutation("document-not-required");
      router.refresh();
    } catch {
      showToast("İşlem sırasında sorun oluştu.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="flex min-w-64 flex-col gap-2 lg:min-w-72">
      <div className="flex min-w-0 flex-wrap justify-end gap-2">
        <Link href={record.uploadHref} className="primary-action min-h-11 px-4 text-sm leading-none">
          <FilePlus2 className="h-4 w-4" aria-hidden />
          Belge Yükle
        </Link>
        <button
          type="button"
          className="secondary-action min-h-11 px-4 text-sm leading-none text-slate-700"
          disabled={Boolean(loadingAction)}
          onClick={markNotRequired}
        >
          {loadingAction === "ignore" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MoreHorizontal className="h-4 w-4" aria-hidden />}
          Gerekmiyor
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <select
          className="field min-h-11 text-sm"
          value={selectedDocumentId}
          onChange={(event) => setSelectedDocumentId(event.currentTarget.value)}
          disabled={documentOptions.length === 0 || Boolean(loadingAction)}
          aria-label="Mevcut belge seç"
        >
          {documentOptions.length === 0 ? (
            <option value="">Bağlanabilecek belge yok</option>
          ) : (
            documentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          className="secondary-action min-h-11 justify-center px-4 text-sm leading-none"
          disabled={!selectedDocumentId || Boolean(loadingAction)}
          onClick={linkSelectedDocument}
        >
          {loadingAction === "link" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
          Bağla
        </button>
      </div>
    </div>
  );
}

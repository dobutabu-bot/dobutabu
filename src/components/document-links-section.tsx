"use client";

import { Download, Eye, FilePlus2, Link2, Loader2, Unlink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { showToast } from "@/components/toast";
import { emitAppDataMutation } from "@/lib/client-sync";
import {
  documentLinkEntityLabels,
  type DocumentLinkEntityType,
  type DocumentLinkOption,
  type LinkedDocumentItem
} from "@/lib/document-link-types";
import { cn } from "@/lib/utils";

type DocumentLinksSectionProps = {
  entityType: DocumentLinkEntityType;
  entityId: string;
  documents: LinkedDocumentItem[];
  options: DocumentLinkOption[];
  uploadHref: string;
};

export function DocumentLinksSection({
  entityType,
  entityId,
  documents,
  options,
  uploadHref
}: DocumentLinksSectionProps) {
  const router = useRouter();
  const [selectedDocumentId, setSelectedDocumentId] = useState(options[0]?.id ?? "");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const targetLabel = documentLinkEntityLabels[entityType];
  const selectedOption = useMemo(
    () => options.find((option) => option.id === selectedDocumentId),
    [options, selectedDocumentId]
  );

  async function linkSelectedDocument() {
    if (!selectedDocumentId || loadingAction) {
      return;
    }

    setLoadingAction("link");
    try {
      const response = await fetch("/api/documents/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: selectedDocumentId, entityType, entityId })
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
      showToast("Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function unlinkDocument(documentId: string) {
    if (loadingAction) {
      return;
    }

    setLoadingAction(`unlink-${documentId}`);
    try {
      const response = await fetch("/api/documents/links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, entityType, entityId })
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        showToast(payload?.message || "Belge bağlantısı kaldırılamadı.");
        return;
      }

      showToast("Belge bağlantısı kaldırıldı.");
      emitAppDataMutation("document-unlink");
      router.refresh();
    } catch {
      showToast("Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <section className="surface overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-br from-white via-slate-50 to-slate-100/80 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Belge Bağlantıları</p>
            <h3 className="mt-1 text-base font-semibold text-slate-950">{targetLabel} Belgeleri</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Dekont, fiş, PDF veya ekstreleri bu kayıtla ilişkilendirin. Bağlantı kaldırmak belgeyi silmez.
            </p>
          </div>
          <Link href={uploadHref} className="primary-action w-full justify-center lg:w-auto">
            <FilePlus2 className="h-4 w-4" aria-hidden />
            Belge Yükle
          </Link>
        </div>

        <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="space-y-1">
            <span className="label">Mevcut Belgeyi Bağla</span>
            <select
              className="field"
              value={selectedDocumentId}
              onChange={(event) => setSelectedDocumentId(event.currentTarget.value)}
              disabled={options.length === 0 || Boolean(loadingAction)}
            >
              {options.length === 0 ? (
                <option value="">Bağlanabilecek belge yok</option>
              ) : (
                options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))
              )}
            </select>
            {selectedOption ? <span className="block text-xs leading-5 text-slate-500">{selectedOption.meta}</span> : null}
          </label>
          <button
            type="button"
            className="secondary-action min-h-12 self-end justify-center"
            disabled={!selectedDocumentId || Boolean(loadingAction)}
            onClick={linkSelectedDocument}
          >
            {loadingAction === "link" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
            Bağla
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {documents.length === 0 ? (
          <div className="p-4 text-sm leading-6 text-slate-500">Bu kayda bağlı belge yok.</div>
        ) : (
          documents.map((document) => (
            <article key={document.id} className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                      {document.documentTypeLabel}
                    </span>
                    <span className="text-xs font-medium text-slate-500">{document.dateLabel}</span>
                    <span className="text-xs font-medium text-slate-500">{document.amountLabel}</span>
                  </div>
                  <Link href={`/documents/${document.id}`} className="mt-2 block break-words text-sm font-semibold text-slate-950 hover:underline">
                    {document.title}
                  </Link>
                  <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                    {document.fileName} · {document.fileSizeLabel}
                  </p>
                  {document.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {document.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500 ring-1 ring-inset ring-slate-200">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Link href={`/documents/${document.id}`} className="secondary-action min-h-10 px-3">
                    <Eye className="h-4 w-4" aria-hidden />
                    Görüntüle
                  </Link>
                  <Link href={`/api/documents/${document.id}/download`} className="secondary-action min-h-10 px-3">
                    <Download className="h-4 w-4" aria-hidden />
                    İndir
                  </Link>
                  <button
                    type="button"
                    className={cn("secondary-action min-h-10 px-3 text-rose-700", loadingAction ? "opacity-70" : "")}
                    disabled={Boolean(loadingAction)}
                    onClick={() => unlinkDocument(document.id)}
                  >
                    {loadingAction === `unlink-${document.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Unlink className="h-4 w-4" aria-hidden />
                    )}
                    Bağlantıyı Kaldır
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

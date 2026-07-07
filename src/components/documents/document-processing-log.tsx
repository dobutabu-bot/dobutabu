import type { DocumentExtractionStatus } from "@prisma/client";

import { StatusBadge } from "@/components/status-badge";
import { documentExtractionStatusLabels } from "@/lib/document-labels";
import { formatDate } from "@/lib/utils";

export type DocumentProcessingLogItem = {
  id: string;
  status: DocumentExtractionStatus;
  message: string | null;
  createdAt: Date | string | null;
};

type DocumentProcessingLogProps = {
  logs: DocumentProcessingLogItem[];
};

export function DocumentProcessingLog({ logs }: DocumentProcessingLogProps) {
  return (
    <section className="surface p-4">
      <h2 className="text-sm font-semibold text-slate-950">İşleme Geçmişi</h2>
      <div className="mt-3 grid gap-2">
        {logs.length > 0 ? (
          logs.map((log) => (
            <div key={log.id} className="rounded-2xl border border-slate-100 bg-white/80 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge tone={statusTone(log.status)}>{documentExtractionStatusLabels[log.status]}</StatusBadge>
                <span className="shrink-0 text-xs text-slate-500">{formatDate(log.createdAt)}</span>
              </div>
              {log.message ? <p className="mt-2 leading-6 text-slate-600">{log.message}</p> : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">İşleme logu bulunmuyor.</p>
        )}
      </div>
    </section>
  );
}

function statusTone(status: DocumentExtractionStatus) {
  if (status === "FAILED") {
    return "rose";
  }

  if (status === "COMPLETED") {
    return "green";
  }

  return "neutral";
}

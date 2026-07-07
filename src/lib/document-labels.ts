import type { DocumentExtractionStatus, DocumentType } from "@prisma/client";

export const documentTypeLabels: Record<DocumentType, string> = {
  RECEIPT: "Makbuz",
  BANK_RECEIPT: "Dekont",
  INVOICE: "Fatura",
  EXPENSE_RECEIPT: "Fiş / Gider Belgesi",
  CONTRACT: "Sözleşme",
  BANK_STATEMENT: "Banka Ekstresi",
  TAX_DOCUMENT: "Vergi Belgesi",
  OTHER: "Diğer"
};

export const documentExtractionStatusLabels: Record<DocumentExtractionStatus, string> = {
  NOT_PROCESSED: "İşlenmedi",
  PROCESSING: "İşleniyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız"
};

export function documentTypeOptions() {
  return Object.entries(documentTypeLabels).map(([value, label]) => ({ value, label }));
}

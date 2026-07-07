export const documentLinkEntityTypes = [
  "CLIENT",
  "CASE_FILE",
  "INCOME",
  "EXPENSE",
  "INVOICE_OR_RECEIPT",
  "CASH_LEDGER_ENTRY"
] as const;

export type DocumentLinkEntityType = (typeof documentLinkEntityTypes)[number];

export const documentLinkEntityLabels: Record<DocumentLinkEntityType, string> = {
  CLIENT: "Müvekkil",
  CASE_FILE: "Dosya",
  INCOME: "Tahsilat",
  EXPENSE: "Gider",
  INVOICE_OR_RECEIPT: "Makbuz/Fatura",
  CASH_LEDGER_ENTRY: "Kasa Hareketi"
};

export const documentLinkFieldByEntityType: Record<DocumentLinkEntityType, string> = {
  CLIENT: "linkedClientId",
  CASE_FILE: "linkedCaseFileId",
  INCOME: "linkedIncomeId",
  EXPENSE: "linkedExpenseId",
  INVOICE_OR_RECEIPT: "linkedInvoiceOrReceiptId",
  CASH_LEDGER_ENTRY: "linkedCashLedgerEntryId"
};

export const documentUploadParamByEntityType: Record<DocumentLinkEntityType, string> = {
  CLIENT: "linkedClientId",
  CASE_FILE: "linkedCaseFileId",
  INCOME: "linkedIncomeId",
  EXPENSE: "linkedExpenseId",
  INVOICE_OR_RECEIPT: "linkedInvoiceOrReceiptId",
  CASH_LEDGER_ENTRY: "linkedCashLedgerEntryId"
};

export type LinkedDocumentItem = {
  id: string;
  title: string;
  documentTypeLabel: string;
  fileName: string;
  fileSizeLabel: string;
  dateLabel: string;
  amountLabel: string;
  tags: string[];
};

export type DocumentLinkOption = {
  id: string;
  label: string;
  meta: string;
};

import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional()
);

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().email("Geçerli bir e-posta yazın").optional()
);

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional()
);

const decimalFormat = z.preprocess(
  (value) => {
    if (typeof value === "number") {
      return String(value);
    }

    if (typeof value === "string") {
      return value.trim().replace(",", ".");
    }

    return value;
  },
  z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Tutarı en fazla 2 ondalık basamakla yazın")
);
const money = decimalFormat.refine((value) => !/^0+(\.0{1,2})?$/.test(value), "Tutar sıfırdan büyük olmalı");
const nonnegativeMoney = decimalFormat;
const optionalNonnegativeMoney = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  decimalFormat.optional()
);
const assetDecimalFormat = z.preprocess(
  (value) => {
    if (typeof value === "number") {
      return String(value);
    }

    if (typeof value === "string") {
      return value.trim().replace(",", ".");
    }

    return value;
  },
  z.string().regex(/^\d+(\.\d{1,8})?$/, "En fazla 8 ondalık basamak kullanın")
);
const optionalAssetDecimal = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  assetDecimalFormat.optional()
);
const booleanInput = z.preprocess((value) => value === true || value === "true", z.boolean());

export const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta yazın"),
  password: z.string().min(10, "Şifre en az 10 karakter olmalı")
});

export const clientInputSchema = z.object({
  name: z.string().trim().min(2, "Müvekkil adı gerekli"),
  type: z.enum(["INDIVIDUAL", "COMPANY"]),
  tcNo: optionalText,
  taxNo: optionalText,
  email: optionalEmail,
  phone: optionalText,
  address: optionalText,
  notes: optionalText
});

export const caseInputSchema = z.object({
  clientId: z.string().min(1, "Müvekkil seçin"),
  title: z.string().trim().min(2, "Dosya başlığı gerekli"),
  fileNumber: optionalText,
  courtOrOffice: optionalText,
  caseType: optionalText,
  status: z.enum(["ACTIVE", "CLOSED", "ARCHIVED"]),
  notes: optionalText
});

export const collectionInputSchema = z.object({
  clientId: z.string().min(1, "Müvekkil seçin"),
  caseFileId: optionalText,
  cashAccountId: optionalText,
  amount: money,
  currency: z.string().trim().length(3, "Para birimi 3 harf olmalı"),
  date: z.string().min(1, "Tahsilat tarihi gerekli"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CREDIT_CARD", "OTHER"]),
  category: z.enum(["LEGAL_FEE", "ADVANCE", "EXPENSE_REIMBURSEMENT", "OTHER"]),
  description: optionalText,
  receiptIssued: booleanInput,
  receiptNumber: optionalText
});

export const expenseInputSchema = z.object({
  clientId: optionalText,
  caseFileId: optionalText,
  cashAccountId: optionalText,
  amount: money,
  currency: z.string().trim().length(3, "Para birimi 3 harf olmalı"),
  date: z.string().min(1, "Ödeme tarihi gerekli"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CREDIT_CARD", "OTHER"]),
  category: z.enum(["COURT_FEE", "NOTARY", "TRAVEL", "ACCOMMODATION", "OFFICE", "TAX", "PERSONNEL", "MEAL", "OTHER"]),
  isClientExpense: booleanInput,
  description: optionalText
});

export const advanceInputSchema = z.object({
  clientId: z.string().min(1, "Müvekkil seçin"),
  caseFileId: optionalText,
  description: z.string().trim().min(2, "Açıklama gerekli"),
  amount: money,
  direction: z.enum(["RECEIVED", "SPENT"]),
  occurredAt: z.string().min(1, "Tarih gerekli"),
  notes: optionalText
});

export const balanceInputSchema = z.object({
  clientId: z.string().min(1, "Müvekkil seçin"),
  caseFileId: optionalText,
  type: z.enum(["RECEIVABLE", "DEBT"]),
  description: z.string().trim().min(2, "Açıklama gerekli"),
  amount: money,
  dueDate: optionalDate,
  status: z.enum(["OPEN", "PAID", "CANCELLED"]),
  notes: optionalText
});

export const receiptInputSchema = z.object({
  clientId: z.string().min(1, "Müvekkil seçin"),
  caseFileId: optionalText,
  number: z.string().trim().min(1, "Belge numarası gerekli"),
  type: z.enum(["E_SMM", "INVOICE", "ARCHIVE_INVOICE", "OTHER"]),
  status: z.enum(["DRAFT", "ISSUED", "CANCELLED", "PAID", "UNPAID"]),
  issueDate: z.string().min(1, "Düzenleme tarihi gerekli"),
  grossAmount: money,
  vatAmount: optionalNonnegativeMoney,
  withholdingAmount: optionalNonnegativeMoney,
  netAmount: money,
  notes: optionalText
});

export const reminderInputSchema = z.object({
  title: z.string().trim().min(2, "Hatırlatma başlığı gerekli"),
  description: optionalText,
  dueDate: z.string().min(1, "Vade tarihi gerekli"),
  reminderType: z.enum(["GENERAL", "EXPENSE", "COLLECTION", "CASE", "INVOICE", "TAX"]),
  amount: optionalNonnegativeMoney,
  currency: z.string().trim().length(3, "Para birimi 3 harf olmalı"),
  cashAccountId: optionalText,
  relatedClientId: optionalText,
  relatedCaseFileId: optionalText,
  status: z.enum(["OPEN", "DONE", "CANCELLED"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]),
  notifyBeforeDays: z.coerce.number().int().min(1).max(15),
  notificationEnabled: booleanInput
});

export const reminderExpensePaymentInputSchema = z.object({
  amount: money,
  date: z.string().min(1, "Ödeme tarihi gerekli"),
  cashAccountId: optionalText,
  category: z.enum(["COURT_FEE", "NOTARY", "TRAVEL", "ACCOMMODATION", "OFFICE", "TAX", "PERSONNEL", "MEAL", "OTHER"]),
  description: optionalText
});

export const cashAccountInputSchema = z.object({
  name: z.string().trim().min(2, "Hesap adı gerekli"),
  type: z.enum(["CASH", "BANK", "CREDIT_CARD", "VIRTUAL", "OTHER"]),
  currency: z.string().trim().length(3, "Para birimi 3 harf olmalı"),
  openingBalance: nonnegativeMoney,
  description: optionalText,
  color: optionalText,
  icon: optionalText,
  isDefault: booleanInput,
  isActive: booleanInput
});

export const cashAdjustmentInputSchema = z.object({
  cashAccountId: z.string().min(1, "Kasa hesabı seçin"),
  direction: z.enum(["IN", "OUT"]),
  amount: money,
  currency: z.string().trim().length(3, "Para birimi 3 harf olmalı"),
  date: z.string().min(1, "Tarih gerekli"),
  description: z.string().trim().min(2, "Açıklama gerekli"),
  referenceNo: optionalText,
  clientId: optionalText,
  caseFileId: optionalText
});

export const cashTransferInputSchema = z.object({
  fromAccountId: z.string().min(1, "Çıkış kasası seçin"),
  toAccountId: z.string().min(1, "Giriş kasası seçin"),
  amount: money,
  currency: z.string().trim().length(3, "Para birimi 3 harf olmalı"),
  date: z.string().min(1, "Tarih gerekli"),
  description: optionalText
});

export const assetAccountInputSchema = z.object({
  name: z.string().trim().min(2, "Varlık adı gerekli"),
  assetType: z.enum(["CASH", "BANK", "FX", "GOLD", "STOCK", "CRYPTO", "FUND", "REAL_ESTATE", "VEHICLE", "RECEIVABLE", "DEBT", "OTHER"]),
  currency: optionalText,
  symbol: optionalText,
  quantity: optionalAssetDecimal,
  unitPrice: optionalNonnegativeMoney,
  manualTotalValue: optionalNonnegativeMoney,
  valuationCurrency: z.string().trim().length(3, "Değerleme para birimi 3 harf olmalı"),
  linkedCashAccountId: optionalText,
  description: optionalText,
  isActive: booleanInput
});

export const assetValuationInputSchema = z.object({
  valuationDate: z.string().min(1, "Değerleme tarihi gerekli"),
  quantity: optionalAssetDecimal,
  unitPrice: optionalNonnegativeMoney,
  totalValue: nonnegativeMoney,
  valuationCurrency: z.string().trim().length(3, "Değerleme para birimi 3 harf olmalı"),
  note: optionalText
});

export const settingsInputSchema = z.object({
  firmName: z.string().trim().min(2, "Büro adı gerekli"),
  ownerName: z.string().trim().min(2, "Avukat adı gerekli"),
  currency: z.string().trim().length(3, "Para birimi 3 harf olmalı")
});

export const documentSettingsInputSchema = z.object({
  documentMaxUploadSizeMb: z
    .string()
    .trim()
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 1 && parsed <= 100;
    }, "Belge yükleme limiti 1 ile 100 MB arasında olmalı")
});

export const documentMetadataInputSchema = z.object({
  title: z.string().trim().min(2, "Belge başlığı gerekli"),
  description: optionalText,
  documentType: z.enum([
    "RECEIPT",
    "BANK_RECEIPT",
    "INVOICE",
    "EXPENSE_RECEIPT",
    "CONTRACT",
    "BANK_STATEMENT",
    "TAX_DOCUMENT",
    "OTHER"
  ]),
  documentDate: optionalText,
  amount: optionalText.refine((value) => {
    if (!value) return true;
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) && parsed >= 0;
  }, "Tutar geçerli bir pozitif sayı olmalı"),
  currency: z.string().trim().length(3, "Para birimi 3 harf olmalı"),
  linkedClientId: optionalText,
  linkedCaseFileId: optionalText,
  linkedIncomeId: optionalText,
  linkedExpenseId: optionalText,
  linkedInvoiceOrReceiptId: optionalText,
  linkedCashLedgerEntryId: optionalText,
  tags: optionalText
});

export const transactionRuleInputSchema = z
  .object({
    name: z.string().trim().min(2, "Kural adı gerekli"),
    matchType: z.enum(["DESCRIPTION_CONTAINS", "COUNTERPARTY_MATCHES", "IBAN_MATCHES", "AMOUNT_RANGE", "REGEX"]),
    keyword: optionalText,
    direction: z.enum(["ANY", "IN", "OUT", "NEUTRAL"]),
    targetGroup: z.enum(["", "INCOME", "EXPENSE", "TRANSFER", "NEUTRAL"]).optional(),
    category: z.string().trim().min(2, "Kategori gerekli"),
    amountMin: optionalNonnegativeMoney,
    amountMax: optionalNonnegativeMoney,
    priority: z.coerce.number().int().min(1).max(999),
    confidence: z.coerce.number().min(0).max(1),
    clientId: optionalText,
    caseFileId: optionalText,
    cashAccountId: optionalText,
    isActive: booleanInput
  })
  .refine((value) => value.matchType === "AMOUNT_RANGE" || Boolean(value.keyword?.trim()), {
    path: ["keyword"],
    message: "Bu kural tipi için eşleşme metni gerekli"
  })
  .refine(
    (value) => {
      if (!value.amountMin || !value.amountMax) return true;
      return Number(value.amountMin) <= Number(value.amountMax);
    },
    {
      path: ["amountMax"],
      message: "Üst tutar alt tutardan küçük olamaz"
    }
  );

export const transactionRuleTestSchema = z.object({
  description: z.string().trim().min(2, "Test açıklaması gerekli"),
  direction: z.enum(["IN", "OUT", "NEUTRAL"]),
  amount: optionalNonnegativeMoney,
  iban: optionalText,
  counterparty: optionalText
});

export const schemaMap = {
  client: clientInputSchema,
  caseFile: caseInputSchema,
  collection: collectionInputSchema,
  expense: expenseInputSchema,
  advance: advanceInputSchema,
  balance: balanceInputSchema,
  receipt: receiptInputSchema,
  reminder: reminderInputSchema,
  reminderExpensePayment: reminderExpensePaymentInputSchema,
  cashAccount: cashAccountInputSchema,
  cashAdjustment: cashAdjustmentInputSchema,
  cashTransfer: cashTransferInputSchema,
  assetAccount: assetAccountInputSchema,
  assetValuation: assetValuationInputSchema,
  settings: settingsInputSchema,
  documentSettings: documentSettingsInputSchema,
  documentMetadata: documentMetadataInputSchema,
  transactionRule: transactionRuleInputSchema
};

export type SchemaKey = keyof typeof schemaMap;

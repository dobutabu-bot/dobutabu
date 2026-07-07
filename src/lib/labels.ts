export const clientTypeLabels = {
  INDIVIDUAL: "Gerçek kişi",
  COMPANY: "Şirket"
};

export const caseStatusLabels = {
  ACTIVE: "Aktif",
  CLOSED: "Kapalı",
  ARCHIVED: "Arşiv"
};

export const paymentMethodLabels = {
  CASH: "Nakit",
  BANK_TRANSFER: "Havale/EFT",
  CREDIT_CARD: "Kredi kartı",
  OTHER: "Diğer"
};

export const incomeCategoryLabels = {
  LEGAL_FEE: "Avukatlık ücreti",
  ADVANCE: "Avans",
  EXPENSE_REIMBURSEMENT: "Masraf iadesi",
  OTHER: "Diğer"
};

export const expenseCategoryLabels = {
  COURT_FEE: "Harç",
  NOTARY: "Noter",
  TRAVEL: "Ulaşım",
  ACCOMMODATION: "Konaklama",
  OFFICE: "Ofis gideri",
  TAX: "Vergi",
  PERSONNEL: "Personel",
  MEAL: "Yemek",
  OTHER: "Diğer"
};

export const advanceDirectionLabels = {
  RECEIVED: "Alındı",
  SPENT: "Harcanan"
};

export const balanceTypeLabels = {
  RECEIVABLE: "Alacak",
  DEBT: "Borç"
};

export const balanceStatusLabels = {
  OPEN: "Açık",
  PAID: "Ödendi",
  CANCELLED: "İptal"
};

export const receiptTypeLabels = {
  E_SMM: "e-SMM",
  INVOICE: "Fatura",
  ARCHIVE_INVOICE: "e-Arşiv",
  OTHER: "Diğer"
};

export const receiptStatusLabels = {
  DRAFT: "Taslak",
  ISSUED: "Kesildi",
  CANCELLED: "İptal",
  PAID: "Ödendi",
  UNPAID: "Ödenmedi"
};

export const reminderTypeLabels = {
  GENERAL: "Genel",
  EXPENSE: "Gider",
  COLLECTION: "Tahsilat",
  CASE: "Dosya",
  INVOICE: "Makbuz/Fatura",
  TAX: "Vergi"
};

export const reminderPriorityLabels = {
  LOW: "Düşük",
  NORMAL: "Normal",
  HIGH: "Yüksek",
  CRITICAL: "Kritik"
};

export const reminderStatusLabels = {
  OPEN: "Açık",
  DONE: "Tamamlandı",
  CANCELLED: "İptal"
};

export const cashAccountTypeLabels = {
  CASH: "Nakit kasa",
  BANK: "Banka hesabı",
  CREDIT_CARD: "Kredi kartı",
  VIRTUAL: "Sanal hesap",
  OTHER: "Diğer"
};

export const cashLedgerEntryTypeLabels = {
  INCOME: "Tahsilat",
  EXPENSE: "Gider",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Kasa düzeltme",
  OPENING_BALANCE: "Açılış bakiyesi"
};

export const cashLedgerDirectionLabels = {
  IN: "Giriş",
  OUT: "Çıkış"
};

export const assetTypeLabels = {
  CASH: "Nakit",
  BANK: "Banka",
  FX: "Döviz",
  GOLD: "Altın",
  STOCK: "Borsa",
  CRYPTO: "Crypto",
  FUND: "Fon",
  REAL_ESTATE: "Gayrimenkul",
  VEHICLE: "Araç",
  RECEIVABLE: "Alacak",
  DEBT: "Borç / negatif varlık",
  OTHER: "Diğer"
};

export const assetValuationSourceLabels = {
  MANUAL: "Manuel",
  IMPORTED: "İçe aktarıldı",
  SYSTEM: "Sistem"
};

export const assetTransactionTypeLabels = {
  BUY: "Alım",
  SELL: "Satım",
  DEPOSIT: "Giriş",
  WITHDRAW: "Çıkış",
  VALUE_UPDATE: "Değer güncelleme",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Düzeltme"
};

export function toOptions(labels: Record<string, string>, first?: { label: string; value: string }) {
  const options = Object.entries(labels).map(([value, label]) => ({ value, label }));
  return first ? [first, ...options] : options;
}

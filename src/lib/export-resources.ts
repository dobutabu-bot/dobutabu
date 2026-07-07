import { dateInputValue } from "@/lib/utils";

export const primaryCsvExports = [
  { resource: "clients", label: "Tüm müvekkiller CSV", filenamePrefix: "muvekkiller" },
  { resource: "cases", label: "Tüm dosyalar CSV", filenamePrefix: "dosyalar" },
  { resource: "collections", label: "Tüm tahsilatlar CSV", filenamePrefix: "tahsilatlar" },
  { resource: "expenses", label: "Tüm giderler CSV", filenamePrefix: "giderler" },
  { resource: "receipts", label: "Tüm makbuz/fatura kayıtları CSV", filenamePrefix: "makbuz-fatura" },
  { resource: "documents", label: "Tüm belge metadata CSV", filenamePrefix: "belge-metadata" },
  { resource: "auditLogs", label: "Tüm işlem geçmişi CSV", filenamePrefix: "islem-gecmisi" }
] as const;

export const allExportResources = [
  ...primaryCsvExports,
  { resource: "advances", label: "Masraf avansları", filenamePrefix: "masraf-avanslari" },
  { resource: "balances", label: "Alacak/borç kayıtları", filenamePrefix: "alacak-borc" },
  { resource: "cashLedger", label: "Kasa hareketleri", filenamePrefix: "kasa-hareketleri" },
  { resource: "capitalAssets", label: "Sermaye varlıkları", filenamePrefix: "sermaye-varliklari" },
  { resource: "assetValuations", label: "Varlık değerleme geçmişi", filenamePrefix: "varlik-degerleme-gecmisi" },
  { resource: "v3Documents", label: "V3 belge raporu", filenamePrefix: "v3-belge-raporu" },
  { resource: "v3BankStatements", label: "V3 banka ekstresi analiz raporu", filenamePrefix: "v3-banka-ekstresi-analiz" },
  { resource: "v3Reconciliation", label: "V3 mutabakat raporu", filenamePrefix: "v3-mutabakat-raporu" },
  { resource: "v3Capital", label: "V3 sermaye raporu", filenamePrefix: "v3-sermaye-raporu" },
  { resource: "summary", label: "Finans özeti", filenamePrefix: "finans-ozeti" }
] as const;

export function exportFilename(resource: string, format: "csv" | "xls", generatedAt = new Date()) {
  const item = allExportResources.find((candidate) => candidate.resource === resource);
  const prefix = item?.filenamePrefix ?? resource;

  return `${prefix}-${dateInputValue(generatedAt)}.${format}`;
}

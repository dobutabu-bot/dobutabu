import { type CapitalImportType } from "@prisma/client";

import { requireApiUser, unauthorized } from "@/lib/api";
import {
  confirmCapitalImport,
  type CapitalImportColumnKey,
  type CapitalImportConfirmSuggestion,
  type CapitalImportMapping,
  type CapitalManualInput
} from "@/lib/capital/capital-import-service";
import { DocumentUploadError } from "@/lib/document-storage";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const formData = await request.formData();
    const result = await confirmCapitalImport(
      user.id,
      fileFromForm(formData),
      {
        importType: importTypeFromForm(formData),
        valuationCurrency: stringFromForm(formData, "valuationCurrency") || "TRY",
        mapping: mappingFromForm(formData),
        manual: manualFromForm(formData)
      },
      suggestionsFromForm(formData)
    );

    return Response.json(result);
  } catch (error) {
    if (error instanceof DocumentUploadError) {
      return Response.json({ message: error.message }, { status: 400 });
    }

    return Response.json({ message: "Mali bilgi importu kaydedilemedi. Önerileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}

function fileFromForm(formData: FormData) {
  const value = formData.get("file");
  return value instanceof File && value.size > 0 ? value : null;
}

function importTypeFromForm(formData: FormData): CapitalImportType {
  const value = stringFromForm(formData, "importType") || "OTHER_FINANCIAL_DOCUMENT";
  return value as CapitalImportType;
}

function mappingFromForm(formData: FormData): CapitalImportMapping {
  const keys: CapitalImportColumnKey[] = ["name", "symbol", "quantity", "unitPrice", "totalValue", "currency"];
  return Object.fromEntries(
    keys
      .map((key) => [key, stringFromForm(formData, `map${key[0].toUpperCase()}${key.slice(1)}`)] as const)
      .filter(([, value]) => Boolean(value))
  ) as CapitalImportMapping;
}

function manualFromForm(formData: FormData): CapitalManualInput {
  return {
    name: stringFromForm(formData, "manualName"),
    assetType: stringFromForm(formData, "manualAssetType") as CapitalManualInput["assetType"],
    symbol: stringFromForm(formData, "manualSymbol"),
    currency: stringFromForm(formData, "manualCurrency"),
    quantity: stringFromForm(formData, "manualQuantity"),
    unitPrice: stringFromForm(formData, "manualUnitPrice"),
    totalValue: stringFromForm(formData, "manualTotalValue"),
    valuationCurrency: stringFromForm(formData, "valuationCurrency")
  };
}

function suggestionsFromForm(formData: FormData): CapitalImportConfirmSuggestion[] {
  const raw = stringFromForm(formData, "suggestions");
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CapitalImportConfirmSuggestion[]) : [];
  } catch {
    throw new DocumentUploadError("Öneri kararları okunamadı. Lütfen sayfayı yenileyip tekrar deneyin.");
  }
}

function stringFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

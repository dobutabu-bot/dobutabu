import { requireApiUser, unauthorized } from "@/lib/api";
import { BankStatementImportFormError, parseBankStatementImportForm } from "@/lib/bank/import/form";
import { buildStagedBankStatementPreview } from "@/lib/bank/import/staging";
import { DocumentUploadError } from "@/lib/document-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const formData = await request.formData();
    const { file, options } = parseBankStatementImportForm(formData, "Önizleme için CSV, XLSX veya PDF dosyası seçin.");
    const preview = await buildStagedBankStatementPreview(user.id, file, options);

    return Response.json({ ok: true, preview });
  } catch (error) {
    if (error instanceof DocumentUploadError || error instanceof BankStatementImportFormError) {
      return Response.json({ message: error.message }, { status: 400 });
    }

    return Response.json({ message: "Ekstre önizlemesi oluşturulamadı. Dosya ve eşleme alanlarını kontrol edin." }, { status: 500 });
  }
}

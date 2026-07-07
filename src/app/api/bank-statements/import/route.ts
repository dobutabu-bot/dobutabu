import { requireApiUser, unauthorized } from "@/lib/api";
import { BankStatementImportFormError, parseBankStatementImportForm } from "@/lib/bank/import/form";
import { commitStagedBankStatementImport } from "@/lib/bank/import/staging";
import { DocumentUploadError } from "@/lib/document-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const formData = await request.formData();
    const { file, options } = parseBankStatementImportForm(formData, "İçe aktarmak için CSV, XLSX veya PDF dosyası seçin.");
    const result = await commitStagedBankStatementImport(user.id, file, options);

    return Response.json({ ok: true, id: result.id, preview: result.preview });
  } catch (error) {
    if (error instanceof DocumentUploadError || error instanceof BankStatementImportFormError) {
      return Response.json({ message: error.message }, { status: 400 });
    }

    return Response.json({ message: "Banka ekstresi içe aktarılamadı. Dosya ve kolon eşlemesini kontrol edin." }, { status: 500 });
  }
}

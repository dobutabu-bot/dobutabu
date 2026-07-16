import { requireApiUser, unauthorized } from "@/lib/api";
import {
  RestoreError,
  restoreAssetAccount,
  restoreBankStatementImport,
  restoreCashAccount,
  restoreCaseFile,
  restoreClient,
  restoreDocument,
  restoreExpense,
  restoreIncome,
  restoreInvoiceOrReceipt,
  restoreReminder
} from "@/lib/restore-service";

type RestoreRouteContext = {
  params: Promise<{ recordType: string; id: string }>;
};

const relationWarning = "Bu kaydın bağlı olduğu müvekkil veya dosya silinmiş olabilir. Önce bağlı kaydı geri almanız gerekebilir.";

export async function POST(_request: Request, context: RestoreRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { recordType, id } = await context.params;

    if (recordType === "clients") {
      await restoreClient(user.id, id);
    } else if (recordType === "cases") {
      await restoreCaseFile(user.id, id);
    } else if (recordType === "incomes") {
      await restoreIncome(user.id, id);
    } else if (recordType === "expenses") {
      await restoreExpense(user.id, id);
    } else if (recordType === "receipts") {
      await restoreInvoiceOrReceipt(user.id, id);
    } else if (recordType === "documents") {
      await restoreDocument(user.id, id);
    } else if (recordType === "bank-imports") {
      await restoreBankStatementImport(user.id, id);
    } else if (recordType === "cash-accounts") {
      await restoreCashAccount(user.id, id);
    } else if (recordType === "reminders") {
      await restoreReminder(user.id, id);
    } else if (recordType === "assets") {
      await restoreAssetAccount(user.id, id);
    } else {
      return Response.json({ message: "Geri alınacak kayıt tipi desteklenmiyor." }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof RestoreError) {
      const message =
        error.message.includes("bağlı") || error.message.includes("Önce bağlı") ? relationWarning : error.message;
      return Response.json({ message }, { status: 400 });
    }

    console.error("Kayıt geri alınamadı", error);
    return Response.json({ message: "Kayıt geri alınamadı. Lütfen tekrar deneyin." }, { status: 500 });
  }
}

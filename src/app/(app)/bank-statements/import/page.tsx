import Link from "@/components/app-link";
import { ArrowLeft } from "lucide-react";

import { BankStatementImportWizard } from "@/components/bank-statement-import-wizard";
import { requireUser } from "@/lib/auth";
import { getDocumentUploadLimitBytes } from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";
import { getFirmSettings } from "@/lib/settings";

export default async function BankStatementImportPage() {
  const user = await requireUser();
  const [cashAccounts, maxUploadBytes, settings] = await Promise.all([
    prisma.cashAccount.findMany({
      where: { userId: user.id, deletedAt: null, isActive: true },
      orderBy: [{ type: "asc" }, { isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, currency: true, isDefault: true }
    }),
    getDocumentUploadLimitBytes(user.id),
    getFirmSettings(user.id)
  ]);

  return (
    <div className="space-y-5">
      <Link href="/bank-statements" className="secondary-action w-fit">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Banka Ekstrelerine Dön
      </Link>
      <BankStatementImportWizard
        cashAccounts={cashAccounts.map((account) => ({
          label: `${account.name}${account.isDefault ? " (Varsayılan)" : ""} · ${account.currency}`,
          value: account.id
        }))}
        defaultCurrency={settings.currency}
        maxUploadMb={Math.round(maxUploadBytes / 1024 / 1024)}
      />
    </div>
  );
}

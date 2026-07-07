import { notFound } from "next/navigation";

import { ReconciliationScreen } from "@/components/reconciliation-screen";
import { requireUser } from "@/lib/auth";
import { getReconciliationData } from "@/lib/reconciliation/reconciliation-service";
import { serializeEntity } from "@/lib/serialization";

type BankStatementReconciliationPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function BankStatementReconciliationPage({ params, searchParams }: BankStatementReconciliationPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const page = positiveInt(query.page, 1);
  const data = await getReconciliationData({ userId: user.id, importId: id, page });

  if (!data.selectedImport) {
    notFound();
  }

  return <ReconciliationScreen data={serializeEntity(data) as typeof data} selectedImportId={id} page={page} />;
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

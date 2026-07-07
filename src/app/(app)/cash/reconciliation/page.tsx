import { BalanceReconciliationScreen } from "@/components/balance-reconciliation-screen";
import { requireUser } from "@/lib/auth";
import { getBalanceReconciliationData } from "@/lib/reconciliation/balance-reconciliation-service";
import { serializeEntity } from "@/lib/serialization";
import { dateInputValue } from "@/lib/utils";

type CashBalanceReconciliationPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function CashBalanceReconciliationPage({ searchParams }: CashBalanceReconciliationPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const cashAccountId = clean(params.cashAccountId);
  const importId = clean(params.importId);
  const data = await getBalanceReconciliationData({ userId: user.id, cashAccountId, importId });
  const safeData = serializeEntity(data) as typeof data;

  return (
    <BalanceReconciliationScreen
      data={safeData}
      selectedCashAccountId={cashAccountId}
      selectedImportId={importId}
      currentDate={dateInputValue()}
    />
  );
}

function clean(value: string | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

import { ReconciliationScreen } from "@/components/reconciliation-screen";
import { requireUser } from "@/lib/auth";
import { getReconciliationData } from "@/lib/reconciliation/reconciliation-service";
import { serializeEntity } from "@/lib/serialization";

type ReconciliationPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ReconciliationPage({ searchParams }: ReconciliationPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const page = positiveInt(params.page, 1);
  const data = await getReconciliationData({ userId: user.id, page });
  const safeData = serializeEntity(data) as typeof data;

  return <ReconciliationScreen data={safeData} page={page} />;
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

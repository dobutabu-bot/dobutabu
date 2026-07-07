import { CapitalHistoryScreen } from "@/components/capital-history-screen";
import { requireUser } from "@/lib/auth";
import { getCapitalCenterData } from "@/lib/capital/capital-data";
import { serializeEntity } from "@/lib/serialization";

export default async function CapitalHistoryPage() {
  const user = await requireUser();
  const data = await getCapitalCenterData(user.id);

  return <CapitalHistoryScreen data={serializeEntity(data) as typeof data} />;
}

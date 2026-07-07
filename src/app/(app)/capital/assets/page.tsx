import { CapitalCenterScreen } from "@/components/capital-center-screen";
import { requireUser } from "@/lib/auth";
import { getCapitalCenterData } from "@/lib/capital/capital-data";
import { serializeEntity } from "@/lib/serialization";

export default async function CapitalAssetsPage() {
  const user = await requireUser();
  const data = await getCapitalCenterData(user.id);

  return <CapitalCenterScreen data={serializeEntity(data) as typeof data} />;
}

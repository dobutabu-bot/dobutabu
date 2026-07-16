import { CapitalCenterScreen } from "@/components/capital-center-screen";
import { requireUser } from "@/lib/auth";
import { getCapitalCenterData } from "@/lib/capital/capital-data";
import { parsePagination } from "@/lib/pagination";
import { serializeEntity } from "@/lib/serialization";

type CapitalAssetsPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

export default async function CapitalAssetsPage({ searchParams }: CapitalAssetsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const pagination = parsePagination(params, { pageSize: 25 });
  const data = await getCapitalCenterData(user.id, "TRY", {
    page: pagination.page,
    pageSize: pagination.pageSize,
    skip: pagination.skip,
    take: pagination.pageSize,
    query
  });

  return <CapitalCenterScreen data={serializeEntity(data) as typeof data} />;
}

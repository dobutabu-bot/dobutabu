import { BankAnalysisScreen } from "@/components/bank-analysis-screen";
import { requireUser } from "@/lib/auth";
import { getBankAnalysisScreenData } from "@/lib/bank-analysis/analyze-statement";
import { serializeEntity } from "@/lib/serialization";

type BankAnalysisPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function BankStatementsAnalysisPage({ searchParams }: BankAnalysisPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const page = positiveInt(params.page, 1);
  const data = await getBankAnalysisScreenData({
    userId: user.id,
    importId: params.importId || null,
    page,
    pageSize: positiveInt(params.pageSize, 25),
    direction: directionParam(params.direction),
    category: params.category || null,
    match: matchParam(params.match)
  });
  const safeData = serializeEntity(data) as typeof data;

  return <BankAnalysisScreen data={safeData} selectedImportId={params.importId ?? null} page={page} searchParams={params} />;
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function directionParam(value: string | undefined) {
  return value === "IN" || value === "OUT" || value === "NEUTRAL" ? value : "ALL";
}

function matchParam(value: string | undefined) {
  return value === "MATCHED" || value === "SUGGESTED" || value === "UNMATCHED" ? value : "ALL";
}

import { notFound } from "next/navigation";

import { BankAnalysisScreen } from "@/components/bank-analysis-screen";
import { requireUser } from "@/lib/auth";
import { getBankAnalysisScreenData } from "@/lib/bank-analysis/analyze-statement";
import { serializeEntity } from "@/lib/serialization";

type BankStatementImportAnalysisPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function BankStatementImportAnalysisPage({ params, searchParams }: BankStatementImportAnalysisPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const page = positiveInt(query.page, 1);
  const data = await getBankAnalysisScreenData({
    userId: user.id,
    importId: id,
    page,
    pageSize: positiveInt(query.pageSize, 25),
    direction: directionParam(query.direction),
    category: query.category || null,
    match: matchParam(query.match)
  });

  if (!data.selectedImport) {
    notFound();
  }

  return <BankAnalysisScreen data={serializeEntity(data) as typeof data} selectedImportId={id} page={page} searchParams={query} />;
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

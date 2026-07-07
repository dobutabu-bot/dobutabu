import { requireApiUser, unauthorized } from "@/lib/api";
import { getBankAnalysisCsvRows } from "@/lib/bank-analysis/analyze-statement";
import { dateInputValue } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const { filename, rows } = await getBankAnalysisCsvRows({
    userId: user.id,
    importId: url.searchParams.get("importId"),
    direction: directionParam(url.searchParams.get("direction")),
    category: url.searchParams.get("category"),
    match: matchParam(url.searchParams.get("match"))
  });
  const datedFilename = filename.replace(/\.csv$/, `-${dateInputValue()}.csv`);
  const csv = toCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${datedFilename}"`
    }
  });
}

function directionParam(value: string | null) {
  return value === "IN" || value === "OUT" || value === "NEUTRAL" ? value : "ALL";
}

function matchParam(value: string | null) {
  return value === "MATCHED" || value === "SUGGESTED" || value === "UNMATCHED" ? value : "ALL";
}

function toCsv(rows: Record<string, string>[]) {
  if (rows.length === 0) {
    return "\uFEFFTarih,Açıklama,Yön,Tutar,Para Birimi,Kategori,Grup,Güven,Müvekkil Önerisi,Dosya Önerisi,Eşleşme Durumu\n";
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(","))];
  return `\uFEFF${lines.join("\n")}`;
}

function csvCell(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

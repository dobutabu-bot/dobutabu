import { requireApiUser, unauthorized } from "@/lib/api";
import { buildExport } from "@/lib/export-data";
import { rowsToCsv } from "@/lib/export";
import { allExportResources, exportFilename } from "@/lib/export-resources";
import { withSensitiveDataHeaders } from "@/lib/security-headers";
import { dateInputValue } from "@/lib/utils";
import { createZip } from "@/lib/zip";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const generatedAt = new Date();
  const backupParams = new URLSearchParams({ includeDeleted: "1" });
  const files = await Promise.all(
    allExportResources.map(async ({ resource }) => {
      const data = await buildExport(user.id, resource, backupParams);
      return {
        name: exportFilename(resource, "csv", generatedAt),
        data: `\ufeff${rowsToCsv(data.headers, data.rows)}`
      };
    })
  );

  const zip = createZip([
    {
      name: "README.txt",
      data: [
        "Hukuk Finans dışa aktarma paketi",
        `Olusturma zamani: ${generatedAt.toISOString()}`,
        "",
        "Yedek dosyalar kişisel veri, müvekkil bilgisi ve finansal bilgi içerebilir. Güvenli yerde saklayınız.",
        "Bu ZIP paketi CSV dosyalarini ve belge metadata kayitlarini icerir. Fiziksel belge dosyalari bu pakete gomulmez; private document storage ayrica yedeklenmelidir.",
        "Resmi e-SMM/e-Fatura arsivi yerine gecmez."
      ].join("\n")
    },
    ...files
  ]);

  return new Response(zip, {
    headers: withSensitiveDataHeaders({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="buro-finans-csv-yedek-${dateInputValue(generatedAt)}.zip"`
    })
  });
}

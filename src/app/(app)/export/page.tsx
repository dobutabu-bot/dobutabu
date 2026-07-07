import { AlertTriangle, Archive, Download, FileSpreadsheet } from "lucide-react";

import { primaryCsvExports } from "@/lib/export-resources";

const warningText =
  "Dışa aktarılan dosyalar kişisel veri, müvekkil bilgisi, belge metadata, banka ekstresi analizi ve sermaye/portföy bilgileri içerebilir. Güvenli yerde saklayınız.";

export default function ExportPage() {
  return (
    <div className="space-y-5">
      <section className="notice">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p>{warningText}</p>
          <p className="text-xs text-slate-500">CSV çıktılarında fiziksel dosya yolu ve tam extracted text gösterilmez.</p>
        </div>
      </section>

      <section className="surface p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
            <Archive className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-950">Tüm verileri ZIP olarak dışa aktar</h2>
            <p className="text-xs text-slate-500">CSV dosyaları tek paket halinde indirilir.</p>
          </div>
        </div>
        <a
          href="/api/export/zip"
          className="primary-action w-full sm:w-auto"
        >
          <Download className="h-4 w-4" aria-hidden />
          ZIP indir
        </a>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {primaryCsvExports.map((item) => (
          <div key={item.resource} className="surface p-4">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <FileSpreadsheet className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="text-sm font-semibold text-slate-950">{item.label}</h2>
            </div>
            <a
              href={`/api/export?resource=${item.resource}&format=csv`}
              className="secondary-action w-full"
            >
              <Download className="h-4 w-4" aria-hidden />
              CSV indir
            </a>
          </div>
        ))}
      </section>
    </div>
  );
}

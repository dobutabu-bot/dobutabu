import { AlertTriangle, ArrowLeft, FileQuestion, FileText, HandCoins, ReceiptText, WalletCards } from "lucide-react";
import Link from "@/components/app-link";

import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { MissingDocumentActions } from "@/components/missing-document-actions";
import { requireUser } from "@/lib/auth";
import { getMissingDocumentsData, type MissingDocumentRecord, type UnlinkedFinancialDocument } from "@/lib/missing-documents";

export default async function MissingDocumentsPage() {
  const user = await requireUser();
  const data = await getMissingDocumentsData(user.id);

  return (
    <div className="space-y-5">
      <section className="surface-dark overflow-hidden p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Link href="/documents" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Belgelere dön
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Belge Kontrol Merkezi</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white sm:text-5xl">Belgesiz Finans Kayıtları</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Dekont, fiş, makbuz veya PDF bağlantısı olmayan tahsilat, gider, kasa hareketi ve makbuz/fatura kayıtlarını tek ekranda takip edin.
            </p>
          </div>
          <div className="digital-glass p-4 lg:min-w-72">
            <p className="text-xs font-medium uppercase text-slate-400">Eksik belge durumu</p>
            <p className="mt-2 text-3xl font-semibold text-white tabular-nums">{data.summary.totalMissingRecords}</p>
            <p className="mt-1 text-sm text-slate-400">Finans kaydı belge bekliyor</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Belgesiz Tahsilat" value={`${data.summary.missingIncomes}`} detail="Dekont/makbuz bekleyen" icon={HandCoins} tone={data.summary.missingIncomes > 0 ? "amber" : "green"} />
        <MetricCard title="Belgesiz Gider" value={`${data.summary.missingExpenses}`} detail="Fiş/fatura/dekont bekleyen" icon={ReceiptText} tone={data.summary.missingExpenses > 0 ? "rose" : "green"} />
        <MetricCard title="Belgesiz Kasa" value={`${data.summary.missingCashLedgerEntries}`} detail="Manuel hareket ve transferler" icon={WalletCards} tone={data.summary.missingCashLedgerEntries > 0 ? "amber" : "green"} />
        <MetricCard title="Belgesiz Belge Kaydı" value={`${data.summary.missingInvoiceOrReceipts}`} detail="Makbuz/fatura takip kaydı" icon={FileText} tone={data.summary.missingInvoiceOrReceipts > 0 ? "amber" : "green"} />
        <MetricCard title="Finanssız Belge" value={`${data.summary.documentsWithoutFinancialRecord}`} detail="Belge var, finans linki yok" icon={FileQuestion} tone={data.summary.documentsWithoutFinancialRecord > 0 ? "amber" : "green"} />
      </section>

      <section className="surface flex gap-3 p-4 text-sm leading-6 text-slate-600">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <p>
          “Belge gerekmiyor” işaretlenen kayıtlar bu listeden çıkarılır ve işlem geçmişine yazılır. Belge bağlantısı kurmak kaydı silmez; yalnızca ilgili belgeyi finans kaydıyla ilişkilendirir.
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Belge Bekleyen Finans Kayıtları</h2>
          <p className="mt-1 text-xs text-slate-500">Belge yükleyebilir, mevcut belge bağlayabilir veya belge gerekmiyor olarak işaretleyebilirsiniz.</p>
        </div>
        <DataTable<MissingDocumentRecord>
          rows={data.records}
          empty="Belge bekleyen finans kaydı yok"
          columns={[
            { header: "Kayıt Türü", cell: (row) => <span className="font-semibold text-slate-950">{row.typeLabel}</span> },
            { header: "Tarih", cell: (row) => row.date },
            {
              header: "Tutar",
              cell: (row) => <span className={row.amount < 0 ? "font-semibold text-rose-700 tabular-nums" : "font-semibold text-emerald-700 tabular-nums"}>{row.amountLabel}</span>
            },
            { header: "Müvekkil", cell: (row) => row.client },
            { header: "Dosya", cell: (row) => row.caseFile },
            {
              header: "Açıklama",
              cell: (row) => (
                <Link href={row.detailHref} className="line-clamp-2 font-medium text-slate-800 hover:underline">
                  {row.description}
                </Link>
              )
            },
            {
              header: "İşlem",
              cell: (row) => <MissingDocumentActions record={row} documentOptions={data.documentOptions} />
            }
          ]}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Belgeye Bağlı Ama Finans Kaydı Olmayan Dokümanlar</h2>
          <p className="mt-1 text-xs text-slate-500">Müvekkil veya dosyaya bağlı olsa bile tahsilat/gider/makbuz/kasa hareketi bağlantısı olmayan belgeler.</p>
        </div>
        <DataTable<UnlinkedFinancialDocument>
          rows={data.unlinkedFinancialDocuments}
          empty="Finans kaydı olmayan belge yok"
          columns={[
            { header: "Belge", cell: (row) => <span className="font-semibold text-slate-950">{row.title}</span> },
            { header: "Tarih", cell: (row) => row.date },
            { header: "Tür", cell: (row) => row.documentTypeLabel },
            { header: "Tutar", cell: (row) => row.amountLabel, className: "font-medium text-slate-950 tabular-nums" },
            { header: "Müvekkil", cell: (row) => row.client },
            { header: "Dosya", cell: (row) => row.caseFile },
            { header: "Açıklama", cell: (row) => <span className="line-clamp-2">{row.description}</span> },
            {
              header: "İşlem",
              cell: (row) => (
                <div className="flex min-w-0 justify-end">
                  <Link href={row.detailHref} className="secondary-action min-h-11 px-4 text-sm leading-none">
                    Görüntüle
                  </Link>
                </div>
              )
            }
          ]}
        />
      </section>
    </div>
  );
}

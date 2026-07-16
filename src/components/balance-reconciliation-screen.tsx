import { Landmark, SearchCheck, ShieldAlert, WalletCards } from "lucide-react";
import Link from "@/components/app-link";

import { AmountText } from "@/components/amount-text";
import { BalanceAdjustmentAction } from "@/components/balance-adjustment-action";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ReconciliationActionButton } from "@/components/reconciliation-actions";
import { StatusBadge } from "@/components/status-badge";
import type { getBalanceReconciliationData } from "@/lib/reconciliation/balance-reconciliation-service";
import { cn, formatDate } from "@/lib/utils";

type BalanceReconciliationData = Awaited<ReturnType<typeof getBalanceReconciliationData>>;

type BalanceReconciliationScreenProps = {
  data: BalanceReconciliationData;
  selectedCashAccountId?: string | null;
  selectedImportId?: string | null;
  currentDate: string;
};

export function BalanceReconciliationScreen({
  data,
  selectedCashAccountId,
  selectedImportId,
  currentDate
}: BalanceReconciliationScreenProps) {
  const statusTone = data.summary.status.tone;

  return (
    <div className="w-full max-w-full min-w-0 space-y-5">
      <section className="surface-dark overflow-hidden p-5">
        <div className="relative z-10 flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Bakiye Mutabakatı</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Banka - Kasa Bakiye Kontrolü</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Bankada görünen kapanış bakiyesi ile dijital kasa bakiyesini tek ekranda karşılaştırın. Kasa düzeltmesi kullanıcı onayı olmadan yapılmaz.
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <Link href="/reconciliation" className="secondary-action min-h-11 border-white/15 bg-white/10 text-white hover:bg-white/15">
              Detaylı mutabakat
            </Link>
            <Link href="/bank-statements/import" className="primary-action min-h-11">
              Ekstre yükle
            </Link>
          </div>
        </div>

        <div className="mt-5 min-w-0 rounded-3xl border border-white/10 bg-white/[0.06] p-4">
          <form className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" action="/cash/reconciliation">
            <label className="min-w-0 space-y-1">
              <span className="text-xs font-medium text-slate-300">Hesap seçimi</span>
              <select className="field min-h-11 w-full min-w-0 border-white/10 bg-slate-950/70 text-white" name="cashAccountId" defaultValue={selectedCashAccountId ?? ""}>
                <option value="">Tüm kasa hesapları</option>
                {data.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.currency}
                    {account.isDefault ? " · Varsayılan" : ""}
                    {!account.isActive ? " · Pasif" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 space-y-1">
              <span className="text-xs font-medium text-slate-300">Banka ekstresi seçimi</span>
              <select className="field min-h-11 w-full min-w-0 border-white/10 bg-slate-950/70 text-white" name="importId" defaultValue={selectedImportId ?? ""}>
                <option value="">Seçili hesabın son ekstresi</option>
                {data.imports.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.bankName} · {item.cashAccountName} · {item.periodLabel}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid min-w-0 gap-2 sm:grid-cols-2 md:col-span-2 xl:col-span-1 xl:flex xl:items-end">
              <button type="submit" className="primary-action h-11 w-full xl:w-auto xl:flex-none">
                Karşılaştır
              </button>
              <Link href="/cash/reconciliation" className="secondary-action h-11 w-full border-white/15 bg-white/10 text-white hover:bg-white/15 xl:w-auto xl:flex-none">
                Temizle
              </Link>
            </div>
          </form>
        </div>
      </section>

      <section className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <BalanceMetric
          label="Ekstre kapanış bakiyesi"
          value={<AmountText value={data.summary.bankBalance} currency={data.summary.currency} showSign size="lg" variant="strong" />}
          detail={data.balanceImport ? `${data.balanceImport.bankName} · ${data.balanceImport.periodLabel}` : "Ekstre yok"}
          icon={<Landmark className="h-5 w-5" aria-hidden />}
        />
        <BalanceMetric
          label="Sistem kasa bakiyesi"
          value={<AmountText value={data.summary.systemBalance} currency={data.summary.currency} showSign size="lg" variant="strong" />}
          detail={data.selectedAccount ? data.selectedAccount.name : "Seçili para birimindeki toplam"}
          icon={<WalletCards className="h-5 w-5" aria-hidden />}
        />
        <BalanceMetric
          label="Fark"
          value={<AmountText value={data.summary.difference} currency={data.summary.currency} showSign size="lg" variant="strong" />}
          detail="Banka bakiyesi - sistem bakiyesi"
          icon={<SearchCheck className="h-5 w-5" aria-hidden />}
          tone={statusTone}
        />
        <BalanceMetric
          label="Fark yüzdesi"
          value={<span className={cn("tabular-finance text-xl font-bold", statusTone === "green" ? "text-emerald-600" : statusTone === "amber" ? "text-amber-600" : "text-rose-600")}>{data.summary.differencePercentLabel}</span>}
          detail={data.summary.status.description}
          icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
          tone={statusTone}
        />
        <article className={cn("min-w-0 rounded-3xl border p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)]", statusPanelClass(statusTone))}>
          <p className="text-xs font-medium uppercase tracking-[0.14em] opacity-80">Durum</p>
          <div className="mt-3">
            <StatusBadge tone={statusTone}>{data.summary.status.label}</StatusBadge>
          </div>
          <p className="mt-3 text-sm leading-5 opacity-85">{data.compareScopeLabel}</p>
        </article>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div className="surface min-w-0 p-4">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-950">Farkın Olası Nedenleri</h2>
              <p className="mt-1 text-xs text-slate-500">Bu maddeler otomatik işlem yapmaz; hangi kayıtların inceleneceğini hızlıca gösterir.</p>
            </div>
            <StatusBadge tone={statusTone}>{data.summary.status.label}</StatusBadge>
          </div>
          <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
            {data.possibleReasons.map((reason) => (
              <article key={reason.title} className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">{reason.title}</p>
                    <p className="mt-1 break-words text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">{reason.description}</p>
                  </div>
                  <span className="shrink-0">
                    <StatusBadge tone={reason.tone}>{reason.value}</StatusBadge>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="surface min-w-0 p-4">
          <h2 className="text-sm font-semibold text-slate-950">Aksiyonlar</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Önce eşleşmeyen hareketleri inceleyin. Kasa düzeltmesini yalnızca farkın gerçekten kayıt düzeltmesi olduğundan eminseniz oluşturun.
          </p>
          <div className="mt-4 grid gap-2">
            <Link href="/reconciliation" className="secondary-action min-h-11 justify-center">
              Eşleştir
            </Link>
            <Link href="/collections?create=1" className="secondary-action min-h-11 justify-center">
              Tahsilat oluştur
            </Link>
            <Link href="/expenses?create=1" className="secondary-action min-h-11 justify-center">
              Gider oluştur
            </Link>
            <BalanceAdjustmentAction
              cashAccountId={data.selectedAccount?.id ?? null}
              difference={data.summary.difference}
              currency={data.summary.currency}
              currentDate={currentDate}
            />
          </div>
          {!data.summary.canCreateAdjustment ? (
            <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
              Kasa düzeltmesi için tek bir kasa hesabı seçilmeli ve fark sıfırdan farklı olmalıdır.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ListPanel
          title="Bankada var, sistemde yok"
          description="Bu hareketlerden tahsilat/gider oluşturabilir, detaylı mutabakat ekranında eşleştirebilir veya yoksayabilirsiniz."
        >
          <DataTable
            rows={data.unmatchedBankRows}
            empty="Bankada olup sistemde görünmeyen hareket yok"
            columns={[
              { header: "Tarih", cell: (row) => (row.date ? formatDate(row.date) : "-") },
              { header: "Açıklama", cell: (row) => <span className="line-clamp-2">{row.description}</span> },
              { header: "Tutar", cell: (row) => <AmountText value={row.signedAmount} currency={row.currency} showSign size="sm" variant="strong" /> },
              { header: "Öneri", cell: (row) => row.category },
              {
                header: "İşlem",
                cell: (row) => (
                  <div className="flex min-w-0 flex-wrap justify-end gap-1.5">
                    {row.direction !== "NEUTRAL" ? (
                      <ReconciliationActionButton
                        endpoint="/api/reconciliation/create-from-row"
                        payload={{ bankRowId: row.id, kind: row.direction === "IN" ? "INCOME" : "EXPENSE" }}
                        label={row.direction === "IN" ? "Tahsilat oluştur" : "Gider oluştur"}
                        variant="success"
                      />
                    ) : null}
                    <ReconciliationActionButton endpoint="/api/reconciliation/ignore" payload={{ bankRowId: row.id }} label="Yoksay" variant="danger" />
                  </div>
                )
              }
            ]}
          />
        </ListPanel>

        <ListPanel title="Sistemde var, bankada yok" description="Bu kasa hareketleri seçili ekstre/hitap eden tarih aralığında bankayla eşleşmemiş görünüyor.">
          <DataTable
            rows={data.unmatchedSystemMovements}
            empty="Sistemde olup bankada görünmeyen hareket yok"
            columns={[
              { header: "Tarih", cell: (row) => formatDate(row.date) },
              { header: "Açıklama", cell: (row) => <span className="line-clamp-2">{row.description}</span> },
              { header: "Tutar", cell: (row) => <AmountText value={row.signedAmount} currency={row.currency} showSign size="sm" variant="strong" /> },
              { header: "Tip", cell: (row) => row.entryType },
              { header: "Kasa", cell: (row) => row.cashAccountName }
            ]}
          />
        </ListPanel>
      </section>

      {data.imports.length === 0 ? (
        <section className="surface min-w-0 p-4">
          <EmptyState
            title="Henüz banka ekstresi yok"
            description="Bakiye mutabakatı için önce banka ekstresi yükleyin. Sistem, ekstre kapanış bakiyesi ile dijital kasa bakiyesini karşılaştırır."
          />
        </section>
      ) : null}
    </div>
  );
}

function BalanceMetric({
  label,
  value,
  detail,
  icon,
  tone = "neutral"
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  icon: React.ReactNode;
  tone?: "green" | "amber" | "rose" | "neutral";
}) {
  return (
    <article className="surface min-w-0 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 break-words text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <span className={toneIconClass(tone)}>{icon}</span>
      </div>
      <div className="mt-3">{value}</div>
      <p className="mt-2 line-clamp-2 break-words text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">{detail}</p>
    </article>
  );
}

function ListPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="surface min-w-0 p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function statusPanelClass(tone: "green" | "amber" | "rose" | "neutral") {
  if (tone === "green") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-950";
  if (tone === "rose") return "border-rose-200 bg-rose-50 text-rose-950";
  return "border-slate-200 bg-white text-slate-950";
}

function toneIconClass(tone: "green" | "amber" | "rose" | "neutral") {
  if (tone === "green") return "text-emerald-600";
  if (tone === "amber") return "text-amber-600";
  if (tone === "rose") return "text-rose-600";
  return "text-slate-400";
}

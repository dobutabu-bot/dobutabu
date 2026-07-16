import { Prisma } from "@prisma/client";
import { Archive, Banknote, CircleDollarSign, Scale, TrendingDown, TrendingUp, WalletCards } from "lucide-react";

import { AppleLikeButton } from "@/components/apple-like-button";
import { RecordActionMenu } from "@/components/action-menu";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { CashMetricCard } from "@/components/cash-metric-card";
import { EntityForm, type EntityFormField } from "@/components/entity-form";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { PremiumCard } from "@/components/premium-card";
import { RecordEditButton } from "@/components/record-edit-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { cashAccountTypeLabels, toOptions } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { cn, dateInputValue, endOfDateInput, formatMoney, startOfDay, startOfMonth, toNumber } from "@/lib/utils";

type AccountMovementTotals = {
  todayIn: Prisma.Decimal;
  todayOut: Prisma.Decimal;
  monthIn: Prisma.Decimal;
  monthOut: Prisma.Decimal;
};

export default async function CashAccountsPage() {
  const user = await requireUser();
  const today = startOfDay(new Date());
  const todayEnd = endOfDateInput(dateInputValue(today));
  const monthStart = startOfMonth(today);
  const accounts = await prisma.cashAccount.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { isActive: "desc" }, { name: "asc" }]
  });
  const [ledgerTotals, activeLedgerCount] = await Promise.all([
    prisma.cashLedgerEntry.groupBy({
      by: ["cashAccountId", "direction"],
      where: { userId: user.id, deletedAt: null, cashAccount: { deletedAt: null } },
      _sum: { amount: true }
    }),
    prisma.cashLedgerEntry.groupBy({
      by: ["cashAccountId"],
      where: { userId: user.id, deletedAt: null, cashAccount: { deletedAt: null } },
      _count: { _all: true }
    })
  ]);
  const rangeEntries = await prisma.cashLedgerEntry.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      cashAccount: { deletedAt: null },
      date: { gte: monthStart, lte: todayEnd }
    },
    select: { cashAccountId: true, direction: true, amount: true, date: true }
  });
  const activeLedgerCountMap = new Map(activeLedgerCount.map((row) => [row.cashAccountId, row._count._all]));
  const totalMap = new Map<string, { in: Prisma.Decimal; out: Prisma.Decimal }>();

  for (const row of ledgerTotals) {
    const current = totalMap.get(row.cashAccountId) ?? { in: decimalZero(), out: decimalZero() };
    if (row.direction === "IN") current.in = current.in.plus(row._sum.amount ?? 0);
    if (row.direction === "OUT") current.out = current.out.plus(row._sum.amount ?? 0);
    totalMap.set(row.cashAccountId, current);
  }

  const movementMap = buildMovementMap(rangeEntries, today);
  const totalBalance = accounts.reduce((sum, account) => {
    const totals = totalMap.get(account.id) ?? { in: decimalZero(), out: decimalZero() };
    return sum.plus(account.openingBalance).plus(totals.in).minus(totals.out);
  }, decimalZero());
  const activeCount = accounts.filter((account) => account.isActive).length;
  const accountFields = cashAccountFields();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">V2 Dijital Kasa</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Kasa Hesapları</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Nakit, banka, kredi kartı ve sanal hesap bakiyelerini tek yerde takip edin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AppleLikeButton href="/cash/accounts" icon={WalletCards}>
            Hesaplar
          </AppleLikeButton>
          <AppleLikeButton href="/cash/ledger" icon={Banknote} tone="light">
            Kasa hareketleri
          </AppleLikeButton>
          <AppleLikeButton href="/cash/reconciliation" icon={Scale} tone="light">
            Bakiye kontrolü
          </AppleLikeButton>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          title="Toplam Kasa Bakiyesi"
          value={formatMoney(totalBalance)}
          detail={`${accounts.length} hesap`}
          icon={CircleDollarSign}
          tone={totalBalance.greaterThanOrEqualTo(0) ? "green" : "rose"}
        />
        <MetricCard title="Aktif Hesap" value={`${activeCount} adet`} detail="Yeni işlemlerde seçilebilir" icon={WalletCards} />
        <MetricCard
          title="Arşiv/Pasif Hesap"
          value={`${accounts.length - activeCount} adet`}
          detail="Geçmiş hareketleri korunur"
          icon={Archive}
          tone="amber"
        />
      </section>

      <EntityForm
        title="Kasa Hesabı Ekle"
        endpoint="/api/cash/accounts"
        schemaKey="cashAccount"
        defaults={{
          name: "",
          type: "CASH",
          currency: "TRY",
          openingBalance: "0",
          description: "",
          color: "#16a34a",
          icon: "wallet",
          isDefault: "false",
          isActive: "true"
        }}
        fields={accountFields}
        submitLabel="Hesap ekle"
        successMessage="Kasa hesabı oluşturuldu."
      />

      {accounts.length === 0 ? (
        <div className="surface">
          <EmptyState title="Henüz kasa hesabı yok" description="İlk hesabınızı ekleyerek dijital kasayı kullanmaya başlayın." />
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {accounts.map((account) => {
            const totals = totalMap.get(account.id) ?? { in: decimalZero(), out: decimalZero() };
            const movement = movementMap.get(account.id) ?? emptyMovementTotals();
            const balance = account.openingBalance.plus(totals.in).minus(totals.out);
            const monthNet = movement.monthIn.minus(movement.monthOut);
            const balanceNumber = toNumber(balance);
            const movementCount = activeLedgerCountMap.get(account.id) ?? 0;

            return (
              <PremiumCard
                key={account.id}
                as="article"
                className={cn(
                  "p-4",
                  !account.isActive && "border-amber-200 bg-amber-50/60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-slate-950">{account.name}</h3>
                      {account.isDefault ? <StatusBadge tone="green">Varsayılan</StatusBadge> : null}
                      {!account.isActive ? <StatusBadge tone="amber">Arşiv/Pasif</StatusBadge> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{cashAccountTypeLabels[account.type]} · {account.currency}</p>
                  </div>
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-white shadow"
                    style={{ backgroundColor: account.color ?? "#16a34a" }}
                    aria-hidden
                  />
                </div>

                <div className="mt-5">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Güncel bakiye</p>
                  <p className={cn("mt-1 text-3xl font-semibold tabular-nums", balanceNumber >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    {formatMoney(balance, account.currency)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Açılış: {formatMoney(account.openingBalance, account.currency)}</p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <CashMetricCard label="Bugünkü giriş" amount={toNumber(movement.todayIn)} currency={account.currency} icon={TrendingUp} tone="green" />
                  <CashMetricCard label="Bugünkü çıkış" amount={-toNumber(movement.todayOut)} currency={account.currency} icon={TrendingDown} tone="rose" />
                  <CashMetricCard
                    label="Bu ay net"
                    amount={toNumber(monthNet)}
                    currency={account.currency}
                    icon={CircleDollarSign}
                    tone={monthNet.greaterThanOrEqualTo(0) ? "green" : "rose"}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">{movementCount} aktif hareket</p>
                  <RecordActionMenu label={`${account.name} kasa hesabı işlemleri`}>
                    <RecordEditButton
                      title="Kasa Hesabı Düzenle"
                      endpoint={`/api/cash/accounts/${account.id}`}
                      schemaKey="cashAccount"
                      fields={accountFields}
                      defaults={{
                        name: account.name,
                        type: account.type,
                        currency: account.currency,
                        openingBalance: account.openingBalance.toString(),
                        description: account.description ?? "",
                        color: account.color ?? "",
                        icon: account.icon ?? "",
                        isDefault: account.isDefault ? "true" : "false",
                        isActive: account.isActive ? "true" : "false"
                      }}
                      successMessage="Kasa hesabı güncellendi."
                    />
                    {!account.isDefault ? (
                      <ConfirmActionButton
                        endpoint={`/api/cash/accounts/${account.id}`}
                        label="Sil/Arşivle"
                        title="Kasa hesabı silinsin/arşivlensin mi?"
                        description={
                          movementCount > 0
                            ? "Bu hesapta hareket olduğu için hesap pasife alınır; geçmiş hareketler korunur."
                            : "Bu hesap normal listeden kaldırılır."
                        }
                        confirmLabel="Onayla"
                        successMessage={movementCount > 0 ? "Kasa hesabı arşivlendi." : "Kasa hesabı silindi."}
                      />
                    ) : null}
                  </RecordActionMenu>
                </div>
              </PremiumCard>
            );
          })}
        </section>
      )}
    </div>
  );
}

function cashAccountFields(): EntityFormField[] {
  return [
    { name: "name", label: "Hesap adı", placeholder: "Ana Kasa, İş Bankası, Kredi Kartı" },
    { name: "type", label: "Hesap türü", type: "select", options: toOptions(cashAccountTypeLabels) },
    { name: "currency", label: "Para birimi" },
    { name: "openingBalance", label: "Açılış bakiyesi", type: "number", min: "0", step: "0.01" },
    { name: "color", label: "Kart rengi", placeholder: "#16a34a" },
    { name: "icon", label: "İkon anahtarı", placeholder: "wallet" },
    {
      name: "isDefault",
      label: "Varsayılan hesap mı?",
      type: "select",
      options: [
        { label: "Hayır", value: "false" },
        { label: "Evet", value: "true" }
      ]
    },
    {
      name: "isActive",
      label: "Aktif mi?",
      type: "select",
      options: [
        { label: "Evet", value: "true" },
        { label: "Hayır", value: "false" }
      ]
    },
    { name: "description", label: "Açıklama", type: "textarea", className: "md:col-span-2 xl:col-span-3" }
  ];
}

function buildMovementMap(
  rows: Array<{ cashAccountId: string; direction: "IN" | "OUT"; amount: Prisma.Decimal; date: Date }>,
  today: Date
) {
  const map = new Map<string, AccountMovementTotals>();
  const todayKey = dateInputValue(today);

  for (const row of rows) {
    const current = map.get(row.cashAccountId) ?? emptyMovementTotals();
    const isToday = dateInputValue(row.date) === todayKey;

    if (row.direction === "IN") {
      current.monthIn = current.monthIn.plus(row.amount);
      if (isToday) current.todayIn = current.todayIn.plus(row.amount);
    } else {
      current.monthOut = current.monthOut.plus(row.amount);
      if (isToday) current.todayOut = current.todayOut.plus(row.amount);
    }

    map.set(row.cashAccountId, current);
  }

  return map;
}

function emptyMovementTotals(): AccountMovementTotals {
  return {
    todayIn: decimalZero(),
    todayOut: decimalZero(),
    monthIn: decimalZero(),
    monthOut: decimalZero()
  };
}

function decimalZero() {
  return new Prisma.Decimal(0);
}

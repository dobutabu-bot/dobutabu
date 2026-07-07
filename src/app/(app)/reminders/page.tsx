import { BellRing, CalendarClock, CheckCircle2, Clock3 } from "lucide-react";

import { ActionButtons } from "@/components/action-buttons";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { DataTable } from "@/components/data-table";
import type { EntityFormField } from "@/components/entity-form";
import { MetricCard } from "@/components/metric-card";
import { Panel, StackedList } from "@/components/panel";
import { RecordCreateButton } from "@/components/record-create-button";
import { RecordEditButton } from "@/components/record-edit-button";
import { ReminderPayButton } from "@/components/reminder-pay-button";
import { ReminderStatusButton } from "@/components/reminder-status-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { expenseCategoryLabels, reminderPriorityLabels, reminderStatusLabels, reminderTypeLabels, toOptions } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { getReminderFormOptions } from "@/lib/reminders/reminder-data";
import { addDays, dateInputValue, formatDate, formatDirectionalMoney, startOfDay } from "@/lib/utils";

export default async function RemindersPage() {
  const user = await requireUser();
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const [reminders, formOptions] = await Promise.all([
    prisma.taskReminder.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      include: { relatedClient: true, relatedCaseFile: true, cashAccount: { select: { id: true, name: true } } }
    }),
    getReminderFormOptions(user.id)
  ]);
  const { clientOptions, caseOptions, cashAccountOptions, defaultCashAccountId } = formOptions;
  const fields = reminderFields(clientOptions, caseOptions, cashAccountOptions);
  const paymentFields = reminderPaymentFields(cashAccountOptions);

  const openReminders = reminders.filter((reminder) => reminder.status === "OPEN");
  const todayReminders = openReminders.filter((reminder) => reminder.dueDate >= today && reminder.dueDate < tomorrow);
  const overdueReminders = openReminders.filter((reminder) => reminder.dueDate < today);
  const approachingReminders = openReminders.filter(
    (reminder) =>
      reminder.notificationEnabled && reminder.dueDate >= today && reminder.dueDate <= addDays(today, reminder.notifyBeforeDays)
  );
  const doneReminders = reminders.filter((reminder) => reminder.status === "DONE");
  const cancelledReminders = reminders.filter((reminder) => reminder.status === "CANCELLED");

  return (
    <div className="space-y-5">
      <section className="surface-dark flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase text-slate-400">Operasyon kontrol merkezi</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Hatırlatmalar</h1>
          <p className="mt-2 text-sm text-slate-300">Vade, tahsilat, gider, dosya ve vergi takibi</p>
        </div>
        <RecordCreateButton
          label="Hatırlatma Ekle"
          title="Hatırlatma Ekle"
          endpoint="/api/reminders"
          schemaKey="reminder"
          autoOpenParam="create"
          submitLabel="Hatırlatma ekle"
          defaults={reminderCreateDefaults(defaultCashAccountId)}
          fields={fields}
          successMessage="Hatırlatma oluşturuldu."
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Açık Hatırlatma" value={String(openReminders.length)} detail="Takip bekleyen kayıtlar" icon={BellRing} tone="green" />
        <MetricCard title="Yaklaşıyor" value={String(approachingReminders.length)} detail={`${todayReminders.length} kayıt bugün vadeli`} icon={CalendarClock} tone="amber" />
        <MetricCard title="Geciken" value={String(overdueReminders.length)} detail="Vadesi geçen açık kayıtlar" icon={Clock3} tone="rose" />
        <MetricCard title="Kapanan" value={String(doneReminders.length + cancelledReminders.length)} detail={`${doneReminders.length} tamamlandı · ${cancelledReminders.length} iptal`} icon={CheckCircle2} tone="neutral" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title="Geciken Hatırlatmalar" icon={<Clock3 className="h-4 w-4" aria-hidden />}>
          <StackedList empty="Geciken hatırlatma yok">
            {overdueReminders.slice(0, 8).map((reminder) => (
              <ReminderListItem key={reminder.id} reminder={reminder} today={today} />
            ))}
          </StackedList>
        </Panel>

        <Panel title="Yaklaşan Hatırlatmalar" icon={<CalendarClock className="h-4 w-4" aria-hidden />}>
          <StackedList empty="Yaklaşan hatırlatma yok">
            {[...todayReminders, ...approachingReminders]
              .filter((reminder, index, source) => source.findIndex((item) => item.id === reminder.id) === index)
              .slice(0, 8)
              .map((reminder) => (
                <ReminderListItem key={reminder.id} reminder={reminder} today={today} />
              ))}
          </StackedList>
        </Panel>
      </section>

      <DataTable
        rows={reminders}
        empty="Henüz hatırlatma yok"
        columns={[
          { header: "Başlık", cell: (row) => <span className="font-medium text-slate-950">{row.title}</span> },
          { header: "Tür", cell: (row) => reminderTypeLabels[row.reminderType] },
          { header: "Vade", cell: (row) => formatDate(row.dueDate) },
          {
            header: "Tutar",
            cell: (row) =>
              row.amount ? (
                <span className={`font-medium tabular-finance ${reminderAmountClass(row.reminderType)}`}>
                  {reminderAmountLabel(row.amount, row.currency, row.reminderType)}
                </span>
              ) : (
                "-"
              )
          },
          {
            header: "Kasa",
            cell: (row) => (row.reminderType === "EXPENSE" ? row.cashAccount?.name ?? "Varsayılan kasa" : "-")
          },
          { header: "Müvekkil", cell: (row) => row.relatedClient?.name ?? "-" },
          { header: "Dosya", cell: (row) => row.relatedCaseFile?.title ?? "-" },
          { header: "Öncelik", cell: (row) => reminderPriorityLabels[row.priority] },
          { header: "Uyarı", cell: (row) => (row.notificationEnabled ? `${row.notifyBeforeDays} gün önce` : "Kapalı") },
          {
            header: "Durum",
            cell: (row) => {
              const displayState = reminderDisplayState(row, today);
              return (
                <StatusBadge tone={displayState.tone}>
                  {displayState.label}
                </StatusBadge>
              );
            }
          },
          {
            header: "İşlem",
            cell: (row) => {
              const defaults = reminderDefaults(row);

              return (
                <ActionButtons>
                  {row.reminderType === "EXPENSE" && row.status === "OPEN" ? (
                    <ReminderPayButton
                      endpoint={`/api/reminders/${row.id}/pay`}
                      fields={paymentFields}
                      defaults={reminderPaymentDefaults(row, defaultCashAccountId)}
                    />
                  ) : null}
                  <RecordEditButton
                    title="Hatırlatma Düzenle"
                    endpoint={`/api/reminders/${row.id}`}
                    schemaKey="reminder"
                    fields={fields}
                    defaults={defaults}
                    successMessage="Hatırlatma güncellendi."
                    successMessageRules={[
                      { field: "status", value: "DONE", message: "Hatırlatma tamamlandı." },
                      { field: "status", value: "CANCELLED", message: "Hatırlatma iptal edildi." }
                    ]}
                  />
                  <ReminderStatusButton
                    endpoint={`/api/reminders/${row.id}`}
                    payload={defaults}
                    nextStatus={row.status === "OPEN" ? "DONE" : "OPEN"}
                  />
                  <ConfirmActionButton
                    endpoint={`/api/reminders/${row.id}`}
                    label="Sil"
                    title="Hatırlatma silinsin mi?"
                    description="Bu hatırlatma normal listelerden kaldırılır, geçmiş kayıtları korunur."
                    confirmLabel="Sil"
                    successMessage="Hatırlatma silindi."
                  />
                </ActionButtons>
              );
            }
          }
        ]}
      />
    </div>
  );
}

function reminderContext(reminder: {
  reminderType: keyof typeof reminderTypeLabels;
  relatedClient: { name: string } | null;
  relatedCaseFile: { title: string } | null;
  cashAccount?: { name: string } | null;
}) {
  return [
    reminder.relatedClient?.name,
    reminder.relatedCaseFile?.title,
    reminder.reminderType === "EXPENSE" ? reminder.cashAccount?.name ?? "Varsayılan kasa" : null
  ]
    .filter(Boolean)
    .join(" · ");
}

function ReminderListItem({
  reminder,
  today
}: {
  reminder: {
    title: string;
    description: string | null;
    dueDate: Date;
    reminderType: keyof typeof reminderTypeLabels;
    amount: unknown;
    currency: string;
    priority: keyof typeof reminderPriorityLabels;
    notifyBeforeDays: number;
    notificationEnabled: boolean;
    status: keyof typeof reminderStatusLabels;
    relatedClient: { name: string } | null;
    relatedCaseFile: { title: string } | null;
    cashAccount?: { name: string } | null;
  };
  today: Date;
}) {
  const displayState = reminderDisplayState(reminder, today);
  const context = reminderContext(reminder);
  const amount = reminder.amount ? reminderAmountLabel(reminder.amount, reminder.currency, reminder.reminderType) : "";

  return (
    <div className="rounded-lg px-2 py-3 transition hover:bg-slate-50 sm:px-3">
      <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-slate-950">{reminder.title}</p>
          <StatusBadge tone={displayState.tone}>{displayState.label}</StatusBadge>
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">
          <span>{reminderTypeLabels[reminder.reminderType]}</span>
          {amount ? <span className={`font-semibold tabular-finance ${reminderAmountClass(reminder.reminderType)}`}> · {amount}</span> : null}
          {context ? ` · ${context}` : reminder.description ? ` · ${reminder.description}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-medium text-slate-700">{formatDate(reminder.dueDate)}</p>
        <p className="mt-1 text-xs text-slate-500">{reminderPriorityLabels[reminder.priority]}</p>
      </div>
      </div>
    </div>
  );
}

function reminderFields(
  clientOptions: { label: string; value: string }[],
  caseOptions: { label: string; value: string }[],
  cashAccountOptions: { label: string; value: string }[]
): EntityFormField[] {
  return [
    { name: "title", label: "Başlık", placeholder: "Örn. KDV ödemesi veya avans kontrolü" },
    { name: "reminderType", label: "Hatırlatma türü", type: "select", options: toOptions(reminderTypeLabels) },
    {
      name: "amount",
      label: "Tutar",
      type: "number",
      step: "0.01",
      min: "0",
      placeholder: "Örn. 12500",
      showWhen: { field: "reminderType", values: ["EXPENSE", "COLLECTION", "INVOICE", "TAX"] },
      highlightWhen: { field: "reminderType", values: ["EXPENSE"] },
      hintWhen: [
        {
          field: "reminderType",
          values: ["EXPENSE"],
          text: "Gider hatırlatmalarında tutar dashboard'daki yaklaşan gider toplamına dahil edilir."
        }
      ]
    },
    {
      name: "currency",
      label: "Para Birimi",
      placeholder: "TRY",
      showWhen: { field: "reminderType", values: ["EXPENSE", "COLLECTION", "INVOICE", "TAX"] }
    },
    {
      name: "cashAccountId",
      label: "Bu gider hangi kasadan ödenecek?",
      type: "select",
      options: cashAccountOptions,
      showWhen: { field: "reminderType", values: ["EXPENSE"] },
      highlightWhen: { field: "reminderType", values: ["EXPENSE"] },
      hintWhen: [
        {
          field: "reminderType",
          values: ["EXPENSE"],
          text: "Ödeme gider kaydına dönüştürülürse kasa çıkışı bu hesaba işlenir."
        }
      ]
    },
    { name: "dueDate", label: "Vade Tarihi", type: "date" },
    {
      name: "notifyBeforeDays",
      label: "Uyarı zamanı",
      type: "select",
      options: [
        { label: "1 gün önce", value: "1" },
        { label: "3 gün önce", value: "3" },
        { label: "7 gün önce", value: "7" },
        { label: "15 gün önce", value: "15" }
      ]
    },
    {
      name: "notificationEnabled",
      label: "Bildirim aktif mi?",
      type: "select",
      options: [
        { label: "Açık", value: "true" },
        { label: "Kapalı", value: "false" }
      ]
    },
    { name: "priority", label: "Öncelik", type: "select", options: toOptions(reminderPriorityLabels) },
    {
      name: "status",
      label: "Durum",
      type: "select",
      options: [
        { label: "Açık", value: "OPEN" },
        { label: "Tamamlandı", value: "DONE" },
        { label: "İptal", value: "CANCELLED" }
      ]
    },
    {
      name: "relatedClientId",
      label: "Müvekkil",
      type: "select",
      options: clientOptions,
      hintWhen: [
        {
          field: "reminderType",
          values: ["COLLECTION"],
          text: "Tahsilat hatırlatmalarında müvekkil seçimi cari takibi netleştirir."
        }
      ]
    },
    {
      name: "relatedCaseFileId",
      label: "Dosya",
      type: "select",
      options: caseOptions,
      className: "xl:col-span-2",
      hintWhen: [
        {
          field: "reminderType",
          values: ["CASE"],
          text: "Dosya hatırlatmalarında ilgili dosyayı seçmeniz önerilir."
        }
      ]
    },
    {
      name: "description",
      label: "Açıklama",
      type: "textarea",
      placeholder: "Kısa not ekleyin",
      placeholderWhen: [
        {
          field: "reminderType",
          values: ["TAX"],
          placeholder: "Örn. KDV beyannamesi, SGK primi, geçici vergi ödemesi"
        }
      ],
      className: "md:col-span-2 xl:col-span-3"
    }
  ];
}

function reminderPaymentFields(cashAccountOptions: { label: string; value: string }[]): EntityFormField[] {
  return [
    { name: "amount", label: "Tutar", type: "number", step: "0.01", min: "0", placeholder: "Örn. 12500" },
    { name: "date", label: "Ödeme tarihi", type: "date" },
    { name: "cashAccountId", label: "Kasa hesabı", type: "select", options: cashAccountOptions },
    { name: "category", label: "Gider kategorisi", type: "select", options: toOptions(expenseCategoryLabels) },
    {
      name: "description",
      label: "Açıklama",
      type: "textarea",
      placeholder: "Ödeme açıklaması",
      className: "md:col-span-2 xl:col-span-3"
    }
  ];
}

function reminderCreateDefaults(defaultCashAccountId = "") {
  return {
    title: "",
    description: "",
    dueDate: dateInputValue(),
    reminderType: "GENERAL",
    amount: "",
    currency: "TRY",
    relatedClientId: "",
    relatedCaseFileId: "",
    cashAccountId: defaultCashAccountId,
    status: "OPEN",
    priority: "NORMAL",
    notifyBeforeDays: "3",
    notificationEnabled: "true"
  };
}

function reminderDefaults(reminder: {
  title: string;
  description: string | null;
  dueDate: Date;
  reminderType: keyof typeof reminderTypeLabels;
  amount: { toString: () => string } | null;
  currency: string;
  relatedClientId: string | null;
  relatedCaseFileId: string | null;
  cashAccountId?: string | null;
  priority: keyof typeof reminderPriorityLabels;
  notifyBeforeDays: number;
  notificationEnabled: boolean;
  status: keyof typeof reminderStatusLabels;
}) {
  return {
    title: reminder.title,
    description: reminder.description ?? "",
    dueDate: dateInputValue(reminder.dueDate),
    reminderType: reminder.reminderType,
    amount: reminder.amount?.toString() ?? "",
    currency: reminder.currency,
    relatedClientId: reminder.relatedClientId ?? "",
    relatedCaseFileId: reminder.relatedCaseFileId ?? "",
    cashAccountId: reminder.cashAccountId ?? "",
    priority: reminder.priority,
    notifyBeforeDays: String(reminder.notifyBeforeDays),
    notificationEnabled: String(reminder.notificationEnabled),
    status: reminder.status
  };
}

function reminderPaymentDefaults(
  reminder: {
    title: string;
    description: string | null;
    dueDate: Date;
    amount: { toString: () => string } | null;
    cashAccountId: string | null;
  },
  defaultCashAccountId = ""
) {
  return {
    amount: reminder.amount?.toString() ?? "",
    date: dateInputValue(),
    cashAccountId: reminder.cashAccountId ?? defaultCashAccountId,
    category: "OTHER",
    description: reminder.description ?? reminder.title
  };
}

function reminderAmountLabel(amount: unknown, currency: string, reminderType: keyof typeof reminderTypeLabels) {
  if (reminderType === "COLLECTION" || reminderType === "INVOICE") {
    return formatDirectionalMoney(amount, "IN", currency);
  }

  if (reminderType === "EXPENSE" || reminderType === "TAX") {
    return formatDirectionalMoney(amount, "OUT", currency);
  }

  return formatDirectionalMoney(amount, "NEUTRAL", currency);
}

function reminderAmountClass(reminderType: keyof typeof reminderTypeLabels) {
  if (reminderType === "COLLECTION" || reminderType === "INVOICE") {
    return "text-emerald-700";
  }

  if (reminderType === "EXPENSE" || reminderType === "TAX") {
    return "text-rose-700";
  }

  return "text-slate-700";
}

function reminderDisplayState(
  reminder: {
    dueDate: Date;
    status: keyof typeof reminderStatusLabels;
    notifyBeforeDays: number;
    notificationEnabled: boolean;
    reminderType?: keyof typeof reminderTypeLabels;
    priority?: keyof typeof reminderPriorityLabels;
  },
  today: Date
) {
  if (reminder.status === "DONE") {
    return { label: "Tamamlandı", tone: "green" as const };
  }

  if (reminder.status === "CANCELLED") {
    return { label: "İptal edildi", tone: "neutral" as const };
  }

  if (reminder.dueDate < today) {
    return { label: "Gecikti", tone: "rose" as const };
  }

  const tomorrow = addDays(today, 1);

  if (reminder.dueDate >= today && reminder.dueDate < tomorrow) {
    return { label: reminder.reminderType === "EXPENSE" ? "Bugün Ödenecek" : "Bugün", tone: "amber" as const };
  }

  if (reminder.priority === "CRITICAL") {
    return { label: "Kritik", tone: "rose" as const };
  }

  if (reminder.reminderType === "EXPENSE" && reminder.notificationEnabled && reminder.dueDate <= addDays(today, 3)) {
    return { label: "Yaklaşan Gider", tone: "amber" as const };
  }

  if (reminder.notificationEnabled && reminder.dueDate <= addDays(today, reminder.notifyBeforeDays)) {
    return { label: "Yaklaşıyor", tone: "amber" as const };
  }

  return { label: "Açık", tone: "neutral" as const };
}

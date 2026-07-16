import { cache } from "react";

import { reminderPriorityLabels, reminderStatusLabels, reminderTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { addDays, dateInputValue, formatDate, formatDirectionalMoney, startOfDay, toNumber } from "@/lib/utils";

export type ReminderOption = {
  label: string;
  value: string;
};

export type ReminderListItemData = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  dueDateInput: string;
  reminderType: keyof typeof reminderTypeLabels;
  reminderTypeLabel: string;
  amount: number;
  amountInput: string;
  amountLabel: string;
  currency: string;
  relatedClientId: string;
  relatedClientName: string;
  relatedCaseFileId: string;
  relatedCaseFileTitle: string;
  status: keyof typeof reminderStatusLabels;
  statusLabel: string;
  priority: keyof typeof reminderPriorityLabels;
  priorityLabel: string;
  notifyBeforeDays: number;
  notificationEnabled: boolean;
  notificationLabel: string;
  cashAccountId: string;
  cashAccountName: string;
  displayStatusLabel: string;
  displayStatusTone: "green" | "rose" | "amber" | "neutral";
};

export async function getReminderFormOptions(userId: string) {
  const [clients, cases, cashAccounts] = await Promise.all([
    prisma.client.findMany({
      where: { userId, archivedAt: null, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.caseFile.findMany({
      where: {
        userId,
        archivedAt: null,
        deletedAt: null,
        status: { not: "ARCHIVED" },
        client: { archivedAt: null, deletedAt: null }
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, clientId: true, title: true, fileNumber: true, client: { select: { name: true } } }
    }),
    prisma.cashAccount.findMany({
      where: { userId, deletedAt: null, isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, isDefault: true, currency: true }
    })
  ]);
  const defaultCashAccount = cashAccounts.find((account) => account.isDefault) ?? cashAccounts[0] ?? null;

  return {
    clientOptions: [
      { label: "Müvekkil seçilmedi", value: "" },
      ...clients.map((client) => ({ label: client.name, value: client.id }))
    ],
    caseOptions: [
      { label: "Dosya seçilmedi", value: "" },
      ...cases.map((caseFile) => ({
        label: `${caseFile.client.name} - ${caseFile.title}${caseFile.fileNumber ? ` (${caseFile.fileNumber})` : ""}`,
        value: caseFile.id,
        parentValue: caseFile.clientId,
        searchTerms: [caseFile.fileNumber ?? "", caseFile.title]
      }))
    ],
    cashAccountOptions: [
      { label: "Varsayılan kasa kullanılsın", value: "" },
      ...cashAccounts.map((account) => ({
        label: `${account.name}${account.isDefault ? " (Varsayılan)" : ""} · ${account.currency}`,
        value: account.id
      }))
    ],
    defaultCashAccountId: defaultCashAccount?.id ?? ""
  };
}

export async function getReminderPageData(userId: string) {
  const reminders = await getReminderRows(userId);
  const openReminders = reminders.filter((reminder) => reminder.status === "OPEN");
  const todayReminders = openReminders.filter((reminder) => reminder.displayStatusLabel === "Bugün");
  const overdueReminders = openReminders.filter((reminder) => reminder.displayStatusLabel === "Gecikti");
  const approachingReminders = openReminders.filter((reminder) => reminder.displayStatusLabel === "Yaklaşıyor");
  const doneReminders = reminders.filter((reminder) => reminder.status === "DONE");
  const cancelledReminders = reminders.filter((reminder) => reminder.status === "CANCELLED");

  return {
    reminders,
    openReminders,
    todayReminders,
    overdueReminders,
    approachingReminders,
    doneReminders,
    cancelledReminders
  };
}

const getReminderRows = cache(async (userId: string): Promise<ReminderListItemData[]> => {
  const today = startOfDay(new Date());
  const reminders = await prisma.taskReminder.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    include: {
      relatedClient: { select: { id: true, name: true } },
      relatedCaseFile: { select: { id: true, title: true } },
      cashAccount: { select: { id: true, name: true } }
    }
  });

  return reminders.map((reminder) => {
    const displayStatus = reminderDisplayStatus(reminder, today);
    return {
      id: reminder.id,
      title: reminder.title,
      description: reminder.description ?? "",
      dueDate: formatDate(reminder.dueDate),
      dueDateInput: dateInputValue(reminder.dueDate),
      reminderType: reminder.reminderType,
      reminderTypeLabel: reminderTypeLabels[reminder.reminderType],
      amount: toNumber(reminder.amount),
      amountInput: reminder.amount?.toString() ?? "",
      amountLabel: reminder.amount ? reminderAmountLabel(reminder.amount, reminder.currency, reminder.reminderType) : "-",
      currency: reminder.currency,
      relatedClientId: reminder.relatedClientId ?? "",
      relatedClientName: reminder.relatedClient?.name ?? "-",
      relatedCaseFileId: reminder.relatedCaseFileId ?? "",
      relatedCaseFileTitle: reminder.relatedCaseFile?.title ?? "-",
      status: reminder.status,
      statusLabel: reminderStatusLabels[reminder.status],
      priority: reminder.priority,
      priorityLabel: reminderPriorityLabels[reminder.priority],
      notifyBeforeDays: reminder.notifyBeforeDays,
      notificationEnabled: reminder.notificationEnabled,
      notificationLabel: reminder.notificationEnabled ? `${reminder.notifyBeforeDays} gün önce` : "Kapalı",
      cashAccountId: reminder.cashAccountId ?? "",
      cashAccountName: reminder.cashAccount?.name ?? (reminder.reminderType === "EXPENSE" ? "Varsayılan kasa" : "-"),
      displayStatusLabel: displayStatus.label,
      displayStatusTone: displayStatus.tone
    };
  });
});

function reminderAmountLabel(amount: unknown, currency: string, reminderType: keyof typeof reminderTypeLabels) {
  if (reminderType === "COLLECTION" || reminderType === "INVOICE") {
    return formatDirectionalMoney(amount, "IN", currency);
  }

  if (reminderType === "EXPENSE" || reminderType === "TAX") {
    return formatDirectionalMoney(amount, "OUT", currency);
  }

  return formatDirectionalMoney(amount, "NEUTRAL", currency);
}

function reminderDisplayStatus(
  reminder: {
    dueDate: Date;
    status: keyof typeof reminderStatusLabels;
    notifyBeforeDays: number;
    notificationEnabled: boolean;
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
    return { label: "Bugün", tone: "amber" as const };
  }

  if (reminder.notificationEnabled && reminder.dueDate <= addDays(today, reminder.notifyBeforeDays)) {
    return { label: "Yaklaşıyor", tone: "amber" as const };
  }

  return { label: "Açık", tone: "neutral" as const };
}

import type { ReminderPriority, ReminderType } from "@prisma/client";

import { reminderPriorityLabels, reminderTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { addDays, formatDate, formatMoney, startOfDay } from "@/lib/utils";

export type ReminderNotificationGroup = "overdue" | "today" | "soon" | "other";

export type ReminderNotificationItem = {
  id: string;
  title: string;
  description: string | null;
  dueDateLabel: string;
  group: ReminderNotificationGroup;
  reminderType: ReminderType;
  reminderTypeLabel: string;
  priority: ReminderPriority;
  priorityLabel: string;
  amountLabel: string | null;
  contextLabel: string | null;
  browserTitle: string;
  browserBody: string;
};

export type ReminderCheckResult = {
  generatedAt: string;
  overdue: ReminderNotificationItem[];
  approaching: ReminderNotificationItem[];
  notifications: ReminderNotificationItem[];
  browserNotifications: ReminderNotificationItem[];
};

export async function checkReminders(userId: string): Promise<ReminderCheckResult> {
  const [notifications, browserNotifications] = await Promise.all([
    getReminderNotificationItems(userId, false),
    getReminderNotificationItems(userId, true)
  ]);

  return {
    generatedAt: new Date().toISOString(),
    overdue: notifications.filter((item) => item.group === "overdue"),
    approaching: notifications.filter((item) => item.group !== "overdue"),
    notifications,
    browserNotifications
  };
}

export async function getReminderNotifications(userId: string): Promise<ReminderNotificationItem[]> {
  return getReminderNotificationItems(userId, false);
}

export async function getBrowserReminderNotifications(userId: string): Promise<ReminderNotificationItem[]> {
  return getReminderNotificationItems(userId, true);
}

async function getReminderNotificationItems(userId: string, onlyUnnotified: boolean): Promise<ReminderNotificationItem[]> {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const threeDaysLater = addDays(today, 3);
  const maxNotificationWindow = addDays(today, 15);
  const reminders = await prisma.taskReminder.findMany({
    where: {
      userId,
      status: "OPEN",
      deletedAt: null,
      notificationEnabled: true,
      ...(onlyUnnotified ? { notifiedAt: null } : {}),
      dueDate: { lte: maxNotificationWindow }
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    include: {
      relatedClient: { select: { name: true } },
      relatedCaseFile: { select: { title: true } },
      cashAccount: { select: { name: true } }
    }
  });

  return reminders
    .filter((reminder) => reminder.dueDate < today || reminder.dueDate <= addDays(today, reminder.notifyBeforeDays))
    .map((reminder) => {
      const group = notificationGroup(reminder.dueDate, today, tomorrow, threeDaysLater);
      const context = [
        reminder.relatedClient?.name,
        reminder.relatedCaseFile?.title,
        reminder.reminderType === "EXPENSE" ? reminder.cashAccount?.name ?? "Varsayılan kasa" : null
      ]
        .filter(Boolean)
        .join(" · ");
      const amountLabel = reminder.amount ? formatMoney(reminder.amount, reminder.currency) : null;

      return {
        id: reminder.id,
        title: reminder.title,
        description: reminder.description,
        dueDateLabel: formatDate(reminder.dueDate),
        group,
        reminderType: reminder.reminderType,
        reminderTypeLabel: reminderTypeLabels[reminder.reminderType],
        priority: reminder.priority,
        priorityLabel: reminderPriorityLabels[reminder.priority],
        amountLabel,
        contextLabel: context || null,
        browserTitle: browserTitle(reminder.reminderType, group),
        browserBody: browserBody(reminder.reminderType, group, amountLabel, formatDate(reminder.dueDate))
      };
    })
    .sort((a, b) => groupOrder(a.group) - groupOrder(b.group) || priorityOrder(b.priority) - priorityOrder(a.priority));
}

function notificationGroup(dueDate: Date, today: Date, tomorrow: Date, threeDaysLater: Date): ReminderNotificationGroup {
  if (dueDate < today) {
    return "overdue";
  }

  if (dueDate < tomorrow) {
    return "today";
  }

  if (dueDate <= threeDaysLater) {
    return "soon";
  }

  return "other";
}

function groupOrder(group: ReminderNotificationGroup) {
  return { overdue: 0, today: 1, soon: 2, other: 3 }[group];
}

function priorityOrder(priority: ReminderPriority) {
  return { LOW: 0, NORMAL: 1, HIGH: 2, CRITICAL: 3 }[priority];
}

function browserTitle(reminderType: ReminderType, group: ReminderNotificationGroup) {
  if (reminderType === "EXPENSE" && group === "today") {
    return "Bugün vadesi gelen gider var";
  }

  if (reminderType === "EXPENSE" && group === "overdue") {
    return "Gecikmiş gider hatırlatması var";
  }

  if (group === "overdue") {
    return `Gecikmiş ${reminderTypeLabels[reminderType].toLocaleLowerCase("tr-TR")} hatırlatması var`;
  }

  if (group === "today") {
    return `Bugün vadesi gelen ${reminderTypeLabels[reminderType].toLocaleLowerCase("tr-TR")} var`;
  }

  if (reminderType === "EXPENSE") {
    return "Gider hatırlatması yaklaşıyor";
  }

  return `${reminderTypeLabels[reminderType]} hatırlatması yaklaşıyor`;
}

function browserBody(
  reminderType: ReminderType,
  group: ReminderNotificationGroup,
  amountLabel: string | null,
  dueDateLabel: string
) {
  if (reminderType === "EXPENSE" && amountLabel) {
    if (group === "today") {
      return `Bugün vadesi gelen ${amountLabel} ödeme var.`;
    }

    if (group === "overdue") {
      return `${amountLabel} tutarlı gider hatırlatması gecikti.`;
    }

    return group === "soon" ? `3 gün içinde ${amountLabel} ödeme var.` : `Yaklaşan ${amountLabel} ödeme var.`;
  }

  return `Vade tarihi: ${dueDateLabel}.`;
}

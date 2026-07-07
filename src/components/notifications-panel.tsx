"use client";

import { ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { showToast } from "@/components/toast";
import { emitAppDataMutation } from "@/lib/client-sync";
import { readNotificationIds, writeReadNotificationIds } from "@/lib/notification-read-state";
import type { ReminderNotificationGroup, ReminderNotificationItem } from "@/lib/reminder-notifications";
import { cn } from "@/lib/utils";

type NotificationsPanelProps = {
  items: ReminderNotificationItem[];
};

const groupLabels: Record<ReminderNotificationGroup, string> = {
  overdue: "Geciken",
  today: "Bugün",
  soon: "3 gün içinde",
  other: "Diğer"
};

export function NotificationsPanel({ items }: NotificationsPanelProps) {
  const router = useRouter();
  const [readIds, setReadIds] = useState<string[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const visibleItems = items.filter((item) => !completedIds.includes(item.id));
  const latestItems = visibleItems.slice(0, 10);
  const readIdSet = useMemo(() => new Set(readIds), [readIds]);
  const unreadCount = visibleItems.filter((item) => !readIdSet.has(item.id)).length;
  const readCount = visibleItems.length - unreadCount;

  useEffect(() => {
    setReadIds(readNotificationIds());
  }, []);

  function updateReadIds(nextIds: string[]) {
    const uniqueIds = writeReadNotificationIds(nextIds);
    setReadIds(uniqueIds);
  }

  function markAsRead(id: string) {
    if (readIdSet.has(id)) {
      return;
    }

    updateReadIds([...readIds, id]);
    showToast("Bildirim okundu.");
  }

  function markAllAsRead() {
    if (visibleItems.length === 0) {
      return;
    }

    updateReadIds([...readIds, ...visibleItems.map((item) => item.id)]);
    showToast("Bildirimler okundu.");
  }

  async function completeReminder(id: string) {
    if (loadingId) {
      return;
    }

    setLoadingId(id);

    try {
      const response = await fetch(`/api/reminders/${id}/complete`, { method: "POST" });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        showToast(payload?.message || "Hatırlatma tamamlanamadı.");
        return;
      }

      setCompletedIds((current) => [...current, id]);
      updateReadIds([...readIds, id]);
      showToast("Hatırlatma tamamlandı.");
      emitAppDataMutation("notification-complete");
      router.refresh();
    } catch {
      showToast("Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="surface overflow-hidden">
      <div className="border-b border-slate-100 bg-white/70 p-4 backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Bildirimler</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Son 10 Bildirim</h2>
            <p className="mt-1 text-sm text-slate-600">Okunmamışlar kırmızı, okunanlar yeşil görünür.</p>
          </div>
          <button
            type="button"
            className="secondary-action min-h-10 px-4"
            disabled={unreadCount === 0}
            onClick={markAllAsRead}
          >
            Tümünü okundu yap
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <NotificationSummary label="Okunmamış" value={unreadCount} tone="rose" />
          <NotificationSummary label="Okunan" value={readCount} tone="green" />
        </div>
      </div>

      {latestItems.length === 0 ? (
        <div className="p-4 text-sm text-slate-600">Bildirim gerektiren açık hatırlatma yok.</div>
      ) : (
        <div className="grid gap-3 p-3">
          {latestItems.map((item) => {
            const read = readIdSet.has(item.id);

            return (
              <NotificationCard
                key={item.id}
                item={item}
                read={read}
                loading={loadingId === item.id}
                onRead={() => markAsRead(item.id)}
                onComplete={() => completeReminder(item.id)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function NotificationCard({
  item,
  read,
  loading,
  onRead,
  onComplete
}: {
  item: ReminderNotificationItem;
  read: boolean;
  loading: boolean;
  onRead: () => void;
  onComplete: () => void;
}) {
  const urgent = item.group === "overdue" || item.priority === "CRITICAL";
  const LoaderIcon = loading ? Loader2 : CheckCircle2;

  return (
    <article
      className={cn(
        "rounded-3xl border p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]",
        read ? "border-emerald-200 bg-emerald-50/60" : urgent ? "border-rose-300 bg-rose-50/70" : "border-rose-200 bg-rose-50/45"
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={read ? "green" : "rose"}>{read ? "Okundu" : "Okunmadı"}</StatusBadge>
            {item.priority === "CRITICAL" ? <StatusBadge tone="rose">Kritik</StatusBadge> : null}
            <StatusBadge tone={notificationBadgeTone(item.reminderType)}>{item.reminderTypeLabel}</StatusBadge>
            <StatusBadge tone={groupTone(item.group)}>{groupLabels[item.group]}</StatusBadge>
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-950">{item.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{item.contextLabel || item.description || "Genel hatırlatma"}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Vade: {item.dueDateLabel}</span>
            {item.amountLabel ? (
              <span className={cn("font-semibold tabular-finance", notificationAmountClass(item.reminderType))}>
                Tutar: {notificationAmountLabel(item)}
              </span>
            ) : null}
            {item.priority !== "CRITICAL" ? <span>Öncelik: {item.priorityLabel}</span> : null}
          </div>
        </div>

        <div className="grid shrink-0 gap-2 sm:grid-cols-3 lg:w-[420px]">
          <button
            type="button"
            className={cn("secondary-action min-h-10", read && "border-emerald-200 bg-emerald-50 text-emerald-800")}
            disabled={read}
            onClick={onRead}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {read ? "Okundu" : "Okundu yap"}
          </button>
          <button type="button" className="secondary-action min-h-10" disabled={loading} onClick={onComplete}>
            <LoaderIcon className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
            {loading ? "İşleniyor" : "Tamamlandı"}
          </button>
          <Link href="/reminders" className="primary-action min-h-10">
            <ArrowUpRight className="h-4 w-4" aria-hidden />
            Detaya git
          </Link>
        </div>
      </div>
    </article>
  );
}

function NotificationSummary({ label, value, tone }: { label: string; value: number; tone: "green" | "rose" }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function notificationAmountClass(reminderType: ReminderNotificationItem["reminderType"]) {
  const tone = notificationAmountTone(reminderType);

  if (tone === "green") {
    return "text-emerald-700";
  }

  if (tone === "rose") {
    return "text-rose-700";
  }

  return "text-slate-700";
}

function notificationBadgeTone(reminderType: ReminderNotificationItem["reminderType"]) {
  const tone = notificationAmountTone(reminderType);

  if (tone === "green" || tone === "rose") {
    return tone;
  }

  return "neutral";
}

function notificationAmountLabel(item: ReminderNotificationItem) {
  if (!item.amountLabel) {
    return "";
  }

  const tone = notificationAmountTone(item.reminderType);

  if (tone === "green") {
    return item.amountLabel.startsWith("+") ? item.amountLabel : `+${item.amountLabel}`;
  }

  if (tone === "rose") {
    return item.amountLabel.startsWith("-") ? item.amountLabel : `-${item.amountLabel}`;
  }

  return item.amountLabel;
}

function notificationAmountTone(reminderType: ReminderNotificationItem["reminderType"]) {
  if (reminderType === "COLLECTION" || reminderType === "INVOICE") {
    return "green" as const;
  }

  if (reminderType === "EXPENSE" || reminderType === "TAX") {
    return "rose" as const;
  }

  return "neutral" as const;
}

function groupTone(group: ReminderNotificationGroup) {
  if (group === "overdue") {
    return "rose";
  }

  if (group === "today") {
    return "amber";
  }

  return "neutral";
}

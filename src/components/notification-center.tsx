"use client";

import { BellRing } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { readNotificationChangeEvent, readNotificationIds, readNotificationStorageKey } from "@/lib/notification-read-state";
import type { ReminderNotificationItem } from "@/lib/reminder-notifications";

type NotificationCenterProps = {
  items: ReminderNotificationItem[];
};

export function NotificationCenter({ items }: NotificationCenterProps) {
  const [readIds, setReadIds] = useState<string[]>([]);
  const readIdSet = useMemo(() => new Set(readIds), [readIds]);
  const unreadCount = items.filter((item) => !readIdSet.has(item.id)).length;

  useEffect(() => {
    setReadIds(readNotificationIds());

    function syncReadIds(event?: Event) {
      if (event instanceof CustomEvent && Array.isArray(event.detail)) {
        setReadIds(event.detail.filter((value): value is string => typeof value === "string"));
        return;
      }

      setReadIds(readNotificationIds());
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === readNotificationStorageKey) {
        syncReadIds();
      }
    }

    window.addEventListener(readNotificationChangeEvent, syncReadIds);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(readNotificationChangeEvent, syncReadIds);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      aria-label={unreadCount > 0 ? `${unreadCount} okunmamış bildirim var` : "Bildirimler"}
    >
      <BellRing className="h-5 w-5" aria-hidden />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-700 px-1 text-[11px] font-semibold text-white ring-2 ring-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

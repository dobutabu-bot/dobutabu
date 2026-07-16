"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  browserNotificationPermissionEvent,
  browserNotificationPermissionKey
} from "@/lib/browser-notifications";
import type { ReminderCheckResult, ReminderNotificationItem } from "@/lib/reminder-notifications";

type BrowserNotificationManagerProps = {
  items: ReminderNotificationItem[];
  onNotificationsChecked?: (items: ReminderNotificationItem[]) => void;
};

const reminderCheckIntervalMs = 10 * 60 * 1000;
const reminderCheckThrottleMs = 30 * 1000;
const initialReminderCheckDelayMs = 750;

export function BrowserNotificationManager({ items, onNotificationsChecked }: BrowserNotificationManagerProps) {
  const pathname = usePathname();
  const sentIdsRef = useRef<Set<string>>(new Set());
  const lastCheckRef = useRef(0);
  const [polledBrowserItems, setPolledBrowserItems] = useState<ReminderNotificationItem[]>([]);
  const browserItems = useMemo(
    () => mergeReminderItems(items, polledBrowserItems),
    [items, polledBrowserItems]
  );

  const deliverReminderItems = useCallback(async (nextItems: ReminderNotificationItem[]) => {
    if (nextItems.length === 0 || typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    const permission = Notification.permission;
    window.localStorage.setItem(browserNotificationPermissionKey, permission);

    if (permission !== "granted") {
      return;
    }

    for (const item of nextItems) {
      const sessionKey = `law-finance-browser-notified-${item.id}`;

      if (sentIdsRef.current.has(item.id) || window.sessionStorage.getItem(sessionKey)) {
        continue;
      }

      sentIdsRef.current.add(item.id);
      window.sessionStorage.setItem(sessionKey, "1");
      await showBrowserNotification(item);
      await fetch(`/api/reminders/${item.id}/notified`, { method: "POST" }).catch(() => undefined);
    }
  }, []);

  const deliverNotifications = useCallback(async () => {
    await deliverReminderItems(browserItems);
  }, [browserItems, deliverReminderItems]);

  const checkDueReminders = useCallback(
    async (force = false, signal?: AbortSignal) => {
      if (typeof window === "undefined") {
        return;
      }

      const now = Date.now();
      if (!force && now - lastCheckRef.current < reminderCheckThrottleMs) {
        return;
      }

      lastCheckRef.current = now;

      try {
        const response = await fetch("/api/reminders/due", {
          cache: "no-store",
          credentials: "same-origin",
          signal
        });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as ReminderCheckResult;
        const nextNotifications = payload.notifications ?? [];
        const nextBrowserNotifications = payload.browserNotifications ?? [];
        setPolledBrowserItems(nextBrowserNotifications);
        onNotificationsChecked?.(nextNotifications);
        await deliverReminderItems(nextBrowserNotifications);
      } catch {
        // Bildirim kontrolü yardımcı bir süreçtir; ana uygulama akışını kesmez.
      }
    },
    [deliverReminderItems, onNotificationsChecked]
  );

  useEffect(() => {
    void deliverNotifications();

    window.addEventListener(browserNotificationPermissionEvent, deliverNotifications);
    return () => window.removeEventListener(browserNotificationPermissionEvent, deliverNotifications);
  }, [deliverNotifications]);

  useEffect(() => {
    const controller = new AbortController();
    const interval = window.setInterval(() => {
      void checkDueReminders(true, controller.signal);
    }, reminderCheckIntervalMs);

    return () => {
      window.clearInterval(interval);
      controller.abort();
    };
  }, [checkDueReminders]);

  useEffect(() => {
    if (pathname !== "/dashboard") {
      return;
    }

    const controller = new AbortController();
    const dashboardCheck = window.setTimeout(() => {
      void checkDueReminders(false, controller.signal);
    }, initialReminderCheckDelayMs);

    return () => {
      window.clearTimeout(dashboardCheck);
      controller.abort();
    };
  }, [checkDueReminders, pathname]);

  return null;
}

function mergeReminderItems(
  initialItems: ReminderNotificationItem[],
  polledItems: ReminderNotificationItem[]
) {
  const merged = new Map<string, ReminderNotificationItem>();

  for (const item of initialItems) {
    merged.set(item.id, item);
  }

  for (const item of polledItems) {
    merged.set(item.id, item);
  }

  return Array.from(merged.values());
}

async function showBrowserNotification(item: ReminderNotificationItem) {
  const options: NotificationOptions = {
    body: item.browserBody,
    icon: "/pwa-icons/icon-192.png",
    badge: "/pwa-icons/icon-192.png",
    tag: `reminder-${item.id}`,
    data: { url: "/reminders" }
  };

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
    if (registration?.showNotification) {
      await registration.showNotification(item.browserTitle, options);
      return;
    }
  }

  const notification = new Notification(item.browserTitle, options);
  notification.onclick = () => {
    window.focus();
    window.location.assign("/reminders");
    notification.close();
  };
}

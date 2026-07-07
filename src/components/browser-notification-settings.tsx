"use client";

import { BellRing, BellOff, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  browserNotificationPermissionEvent,
  browserNotificationPermissionKey
} from "@/lib/browser-notifications";
import { showToast } from "@/components/toast";

type PermissionState = "checking" | "unsupported" | NotificationPermission;

export function BrowserNotificationSettings() {
  const [permission, setPermission] = useState<PermissionState>("checking");

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    const currentPermission = Notification.permission;
    window.localStorage.setItem(browserNotificationPermissionKey, currentPermission);
    setPermission(currentPermission);
  }, []);

  async function requestPermission() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      showToast("Bu tarayıcı bildirimleri desteklemiyor.");
      return;
    }

    const nextPermission = await Notification.requestPermission();
    window.localStorage.setItem(browserNotificationPermissionKey, nextPermission);
    setPermission(nextPermission);

    if (nextPermission === "granted") {
      showToast("Tarayıcı bildirimleri açıldı.");
      window.dispatchEvent(new Event(browserNotificationPermissionEvent));
    } else if (nextPermission === "denied") {
      showToast("Bildirim izni verilmedi. Tarayıcı ayarlarından değiştirebilirsiniz.");
    } else {
      showToast("Bildirim izni daha sonra tekrar istenebilir.");
    }
  }

  const granted = permission === "granted";
  const denied = permission === "denied";
  const unsupported = permission === "unsupported";
  const Icon = granted ? CheckCircle2 : unsupported || denied ? BellOff : BellRing;

  return (
    <section className="surface p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950 sm:text-sm">Bildirimler</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Yaklaşan gider, tahsilat, vergi ve dosya hatırlatmaları için tarayıcı bildirimi alın.
            </p>
            <p className="mt-1 text-xs text-slate-500">{permissionText(permission)}</p>
          </div>
        </div>
        <button
          type="button"
          className="primary-action w-full sm:w-auto"
          disabled={permission === "checking" || granted || unsupported}
          onClick={requestPermission}
        >
          <BellRing className="h-4 w-4" aria-hidden />
          {buttonText(permission)}
        </button>
      </div>
    </section>
  );
}

function permissionText(permission: PermissionState) {
  if (permission === "checking") return "Bildirim durumu kontrol ediliyor.";
  if (permission === "unsupported") return "Bu tarayıcı Notification API desteği sunmuyor.";
  if (permission === "granted") return "Tarayıcı bildirimleri açık. Aynı hatırlatma notifiedAt ile tekrar gönderilmez.";
  if (permission === "denied") return "Tarayıcı bildirim izni reddedildi. İzin tarayıcı ayarlarından değiştirilebilir.";
  return "İzin verilene kadar uygulama içi bildirim merkezi çalışmaya devam eder.";
}

function buttonText(permission: PermissionState) {
  if (permission === "checking") return "Kontrol ediliyor";
  if (permission === "unsupported") return "Desteklenmiyor";
  if (permission === "granted") return "Bildirimler açık";
  if (permission === "denied") return "İzin reddedildi";
  return "Tarayıcı bildirimlerini aç";
}

import { BellRing } from "lucide-react";

import { NotificationsPanel } from "@/components/notifications-panel";
import { requireUser } from "@/lib/auth";
import { getReminderNotifications } from "@/lib/reminder-notifications";
import type { ReminderNotificationItem } from "@/lib/reminder-notifications";
import { serializeEntity } from "@/lib/serialization";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await getReminderNotifications(user.id);
  const safeNotifications = serializeEntity(notifications) as ReminderNotificationItem[];

  return (
    <div className="space-y-5">
      <section className="surface-dark p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-[0_16px_34px_rgba(255,255,255,0.12)]">
            <BellRing className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Bildirim Merkezi</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Bildirimler</h1>
            <p className="mt-1 text-sm text-slate-300">Son bildirimleri okuyun, tamamlayın veya ilgili hatırlatmaya gidin.</p>
          </div>
        </div>
      </section>

      <NotificationsPanel items={safeNotifications} />
    </div>
  );
}

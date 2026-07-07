import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getBrowserReminderNotifications, getReminderNotifications } from "@/lib/reminder-notifications";
import type { ReminderNotificationItem } from "@/lib/reminder-notifications";
import { serializeEntity } from "@/lib/serialization";
import { getFirmSettings } from "@/lib/settings";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, reminderNotifications, browserReminderNotifications] = await Promise.all([
    getFirmSettings(user.id),
    getReminderNotifications(user.id),
    getBrowserReminderNotifications(user.id)
  ]);

  return (
    <AppShell
      user={serializeEntity({ name: user.name, email: user.email }) as { name: string; email: string }}
      firmName={settings.firmName}
      reminderNotifications={serializeEntity(reminderNotifications) as ReminderNotificationItem[]}
      browserReminderNotifications={serializeEntity(browserReminderNotifications) as ReminderNotificationItem[]}
    >
      {children}
    </AppShell>
  );
}

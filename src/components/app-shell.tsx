"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BellRing, FileText, HandCoins, LogOut, Menu, Plus, ReceiptText, X } from "lucide-react";

import { BrowserNotificationManager } from "@/components/browser-notification-manager";
import { GlobalSearch } from "@/components/search/global-search";
import { NotificationCenter } from "@/components/notification-center";
import { PrivacyModeToggle } from "@/components/privacy-mode-toggle";
import { ToastViewport } from "@/components/toast";
import { subscribeAppDataMutation } from "@/lib/client-sync";
import { MOBILE_MENU_NAV_ITEMS, NAV_ITEMS, PRIMARY_MOBILE_NAV_ITEMS, SECONDARY_MOBILE_NAV_ITEMS } from "@/lib/navigation";
import type { ReminderNotificationItem } from "@/lib/reminder-notifications";
import { cn } from "@/lib/utils";

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

type AppShellProps = {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
  };
  firmName: string;
  reminderNotifications: ReminderNotificationItem[];
  browserReminderNotifications: ReminderNotificationItem[];
};

export function AppShell({ children, user, firmName, reminderNotifications, browserReminderNotifications }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hydratedPathname, setHydratedPathname] = useState<string | null>(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [liveReminderNotifications, setLiveReminderNotifications] = useState(reminderNotifications);
  const current = hydratedPathname ? NAV_ITEMS.find((item) => isActivePath(hydratedPathname, item.href)) : null;
  const currentLabel = hydratedPathname?.startsWith("/notifications")
    ? "Bildirimler"
    : hydratedPathname?.startsWith("/search")
      ? "Akıllı Arama"
      : current?.label ?? "Panel";
  const secondaryActive = hydratedPathname
    ? SECONDARY_MOBILE_NAV_ITEMS.some((item) => isActivePath(hydratedPathname, item.href))
    : false;

  useEffect(() => {
    setHydratedPathname(pathname);
    setMobileMenuOpen(false);
    setQuickActionsOpen(false);
  }, [pathname]);

  useEffect(() => {
    setLiveReminderNotifications(reminderNotifications);
  }, [reminderNotifications]);

  useEffect(() => {
    let refreshTimer: number | null = null;

    const unsubscribe = subscribeAppDataMutation(() => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        router.refresh();
      }, 120);
    });

    return () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen" data-app-shell-ready={hydratedPathname ? "true" : "false"}>
      <aside className="app-sidebar fixed inset-y-0 left-0 hidden w-64 px-4 py-5 text-white lg:block">
        <Link href="/dashboard" className="digital-glass flex items-center gap-3 p-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-[0_16px_34px_rgba(255,255,255,0.12)]">
            <FileText className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{firmName}</span>
            <span className="block truncate text-xs text-slate-400">{user.name}</span>
          </span>
        </Link>

        <nav className="mt-6 space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = hydratedPathname ? isActivePath(hydratedPathname, item.href) : false;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-slate-300 transition duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20",
                  active && "bg-white text-slate-950 shadow-[0_14px_30px_rgba(255,255,255,0.08)] hover:bg-white hover:text-slate-950"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <form action="/api/auth/logout" method="post" className="absolute bottom-5 left-4 right-4">
          <button
            type="submit"
            className="digital-row flex min-h-11 w-full items-center gap-3 px-3 py-2 text-sm font-medium text-slate-300 transition duration-200 hover:bg-white/[0.09] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Çıkış
          </button>
        </form>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] shadow-[0_14px_42px_rgba(15,23,42,0.06)] backdrop-blur-2xl lg:px-8 lg:pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-500">{firmName}</p>
              <h1 className="truncate text-lg font-semibold text-slate-950">{currentLabel}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <GlobalSearch />
              <PrivacyModeToggle />
              <NotificationCenter items={liveReminderNotifications} />
              <button
                type="button"
                className={cn("icon-button lg:hidden", secondaryActive && "bg-slate-950 text-white")}
                aria-label="Diğer modülleri aç"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-4 w-4" aria-hidden />
              </button>
              <form action="/api/auth/logout" method="post" className="lg:hidden">
                <button type="submit" className="icon-button" aria-label="Çıkış">
                  <LogOut className="h-4 w-4" aria-hidden />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-8">
          {children}
        </main>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" aria-modal="true" role="dialog">
          <button
            type="button"
            aria-label="Menüyü kapat"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/70 bg-white/90 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-2xl backdrop-blur-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">Mobil menü</p>
                <h2 className="text-base font-semibold text-slate-950">Diğer modüller</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Menüyü kapat" onClick={() => setMobileMenuOpen(false)}>
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {MOBILE_MENU_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = hydratedPathname ? isActivePath(hydratedPathname, item.href) : false;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 active:bg-slate-100",
                      active && "border-slate-950 bg-slate-950 text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)]"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <MobileQuickActions open={quickActionsOpen} onOpenChange={setQuickActionsOpen} />

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/70 bg-white/85 pb-[env(safe-area-inset-bottom)] shadow-[0_-18px_42px_rgba(15,23,42,0.12)] backdrop-blur-2xl lg:hidden"
        aria-hidden={mobileMenuOpen ? true : undefined}
      >
        {PRIMARY_MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = hydratedPathname ? isActivePath(hydratedPathname, item.href) : false;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-slate-500 active:bg-slate-100",
                active && "text-slate-950"
              )}
            >
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-2xl", active && "bg-slate-950 text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)]")}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="w-full truncate px-1 text-center">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <BrowserNotificationManager
        items={browserReminderNotifications}
        onNotificationsChecked={setLiveReminderNotifications}
      />
      <ToastViewport />
    </div>
  );
}

function MobileQuickActions({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const actions = [
    { href: "/collections?create=1", label: "Tahsilat Ekle", icon: HandCoins, tone: "green" },
    { href: "/expenses?create=1", label: "Gider Ekle", icon: ReceiptText, tone: "rose" },
    { href: "/reminders?create=1", label: "Hatırlatma Ekle", icon: BellRing, tone: "amber" }
  ] as const;

  return (
    <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 lg:hidden">
      {open ? (
        <div className="mb-3 w-[min(18rem,calc(100vw-2rem))] rounded-3xl border border-white/70 bg-white/90 p-2 shadow-[0_24px_70px_rgba(15,23,42,0.22)] backdrop-blur-2xl">
          <div className="px-2 pb-1 pt-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Hızlı kayıt</p>
          </div>
          <div className="grid gap-1.5">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-slate-800 transition active:bg-slate-100"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-2xl text-white shadow-[0_12px_26px_rgba(15,23,42,0.16)]",
                      action.tone === "green" && "bg-emerald-700",
                      action.tone === "rose" && "bg-rose-700",
                      action.tone === "amber" && "bg-amber-600"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_20px_45px_rgba(15,23,42,0.30)] transition active:scale-95"
        aria-label={open ? "Hızlı işlem menüsünü kapat" : "Hızlı işlem menüsünü aç"}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        {open ? <X className="h-5 w-5" aria-hidden /> : <Plus className="h-5 w-5" aria-hidden />}
      </button>
    </div>
  );
}

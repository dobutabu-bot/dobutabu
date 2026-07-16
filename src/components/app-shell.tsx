"use client";

import Link from "@/components/app-link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  FileText,
  Landmark,
  LogOut,
  Plus,
  Settings,
  UserCircle,
  X
} from "lucide-react";

import { BrowserNotificationManager } from "@/components/browser-notification-manager";
import { MobileNavigation } from "@/components/mobile-navigation";
import { GlobalSearch } from "@/components/search/global-search";
import { GlobalQuickAdd } from "@/components/global-quick-add";
import { NotificationCenter } from "@/components/notification-center";
import { PrivacyModeToggle } from "@/components/privacy-mode-toggle";
import { Sidebar } from "@/components/sidebar";
import { ToastViewport } from "@/components/toast";
import { TopBar } from "@/components/top-bar";
import { subscribeAppDataMutation } from "@/lib/client-sync";
import {
  COMPACT_DESKTOP_NAV_ITEMS,
  FINANCE_NAV_ITEMS,
  NAV_GROUPS,
  NAV_ITEMS,
  PRIMARY_MOBILE_NAV_ITEMS,
  SECONDARY_MOBILE_NAV_ITEMS
} from "@/lib/navigation";
import type { NavGroup, NavItem } from "@/lib/navigation";
import type { ReminderNotificationItem } from "@/lib/reminder-notifications";
import { cn } from "@/lib/utils";

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function isSettingsPath(pathname: string) {
  return pathname === "/activity" || pathname === "/backup" || pathname === "/install" || isActivePath(pathname, "/settings");
}

function pageReadyTestId(pathname: string) {
  const slug = pathname.replace(/^\/+/, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "root";
  return `page-ready-${slug}`;
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
  const financeMobileActive = hydratedPathname
    ? FINANCE_NAV_ITEMS.some((item) => isActivePath(hydratedPathname, item.href))
    : false;
  const secondaryActive = hydratedPathname
    ? !financeMobileActive && SECONDARY_MOBILE_NAV_ITEMS.some((item) => isActivePath(hydratedPathname, item.href))
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
    function openQuickAdd(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setQuickActionsOpen(true);
      }
    }
    window.addEventListener("keydown", openQuickAdd);
    return () => window.removeEventListener("keydown", openQuickAdd);
  }, []);

  useEffect(() => {
    let refreshTimer: number | null = null;

    const unsubscribe = subscribeAppDataMutation(() => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        router.refresh();
      }, 120);
    }, { includeSameTab: false });

    return () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen" data-app-shell-ready={hydratedPathname === pathname ? "true" : "false"}>
      <Sidebar>
        <Link href="/dashboard" prefetch={false} className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white text-slate-950 shadow-[0_16px_34px_rgba(255,255,255,0.10)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20" aria-label={`${firmName} dashboard`} title={firmName}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <FileText className="h-5 w-5" aria-hidden />
          </span>
        </Link>

        <nav className="mt-5 flex min-h-0 flex-1 flex-col items-center gap-2" aria-label="Ana menü">
          {COMPACT_DESKTOP_NAV_ITEMS.slice(0, 3).map((item) => (
            <RailNavLink key={item.href} item={item} active={hydratedPathname ? isActivePath(hydratedPathname, item.href) : false} />
          ))}
          <FinanceRailMenu pathname={hydratedPathname} />
          {COMPACT_DESKTOP_NAV_ITEMS.slice(3).map((item) => (
            <RailNavLink key={item.href} item={item} active={hydratedPathname ? isActivePath(hydratedPathname, item.href) : false} />
          ))}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-2">
          <RailNavLink
            item={{ href: "/settings", label: "Ayarlar", icon: Settings }}
            active={hydratedPathname ? isSettingsPath(hydratedPathname) : false}
          />
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="group relative flex h-12 w-12 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white/[0.09] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
              aria-label="Çıkış"
              title="Çıkış"
            >
              <LogOut className="h-5 w-5" aria-hidden />
              <RailTooltip label="Çıkış" />
            </button>
          </form>
        </div>
      </Sidebar>

      <div className="lg:pl-[5.5rem]">
        <TopBar>
          <div className="mx-auto flex w-full max-w-[var(--v4-content-max)] flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-500">{firmName}</p>
              <h1 className="truncate text-lg font-semibold text-slate-950">{currentLabel}</h1>
            </div>
            <div className="flex w-full min-w-0 shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-start">
              <div className="min-w-0 flex-1 sm:flex-none">
                <GlobalSearch />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PrivacyModeToggle />
                <NotificationCenter items={liveReminderNotifications} />
                <UserMenu user={user} />
              </div>
            </div>
          </div>
        </TopBar>

        <main
          className="px-4 py-5 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-8"
          data-testid={hydratedPathname ? pageReadyTestId(hydratedPathname) : undefined}
        >
          <div className="app-content-shell">{children}</div>
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

            <div className="scroll-y-stable max-h-[min(72vh,34rem)] space-y-5 overflow-x-hidden pr-1">
              {NAV_GROUPS.map((group) => (
                <MobileMenuGroup key={group.label} group={group} pathname={hydratedPathname} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <GlobalQuickAdd open={quickActionsOpen} onOpenChange={setQuickActionsOpen} />

      <MobileNavigation aria-label="Mobil alt navigasyon" aria-hidden={mobileMenuOpen ? true : undefined}>
        {PRIMARY_MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/cash" ? financeMobileActive : hydratedPathname ? isActivePath(hydratedPathname, item.href) : false;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
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
        <button
          type="button"
          className={cn(
            "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-slate-500 active:bg-slate-100",
            (mobileMenuOpen || secondaryActive) && "text-slate-950"
          )}
          aria-label="Diğer modülleri aç"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(true)}
        >
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-2xl", (mobileMenuOpen || secondaryActive) && "bg-slate-950 text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)]")}>
            <Plus className="h-5 w-5" aria-hidden />
          </span>
          <span>Daha Fazla</span>
        </button>
      </MobileNavigation>

      <BrowserNotificationManager
        items={browserReminderNotifications}
        onNotificationsChecked={setLiveReminderNotifications}
      />
      <ToastViewport />
    </div>
  );
}

function RailNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch={false}
      className={cn(
        "group relative flex h-12 w-12 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white/[0.09] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20",
        active && "bg-white text-slate-950 shadow-[0_14px_30px_rgba(255,255,255,0.08)] hover:bg-white hover:text-slate-950"
      )}
      aria-label={item.label}
      title={item.label}
    >
      <Icon className="h-5 w-5" aria-hidden />
      <RailTooltip label={item.label} />
    </Link>
  );
}

function FinanceRailMenu({ pathname }: { pathname: string | null }) {
  const active = pathname ? FINANCE_NAV_ITEMS.some((item) => isActivePath(pathname, item.href)) : false;
  return (
    <details className="group/finance relative">
      <summary
        className={cn(
          "group relative flex h-12 w-12 cursor-pointer list-none items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white/[0.09] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20 [&::-webkit-details-marker]:hidden",
          active && "bg-white text-slate-950 shadow-[0_14px_30px_rgba(255,255,255,0.08)]"
        )}
        aria-label="Finans menüsünü aç"
        title="Finans"
      >
        <Landmark className="h-5 w-5" aria-hidden />
        <RailTooltip label="Finans" />
      </summary>
      <div className="absolute left-[calc(100%+0.75rem)] top-0 z-50 w-64 rounded-3xl border border-white/70 bg-white/95 p-3 text-slate-950 shadow-[0_26px_70px_rgba(15,23,42,0.22)] backdrop-blur-2xl">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Finans</p>
        <div className="grid gap-1">
          {FINANCE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const itemActive = pathname ? isActivePath(pathname, item.href) : false;
            return (
              <Link key={item.href} href={item.href} prefetch={false} className={cn("flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900", itemActive && "bg-slate-950 text-white hover:bg-slate-900")}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </details>
  );
}

function RailTooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+0.65rem)] top-1/2 z-[60] hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xl group-hover:block group-focus-visible:block">
      {label}
    </span>
  );
}

function MobileMenuGroup({ group, pathname }: { group: NavGroup; pathname: string | null }) {
  return (
    <section className="min-w-0" aria-label={group.label}>
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{group.label}</p>
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        {group.items.map((item) => {
          const Icon = item.icon;
          const active = pathname ? isActivePath(pathname, item.href) : false;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                "flex min-h-12 min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white/65 px-3 py-2 text-sm font-medium text-slate-700 shadow-[0_10px_28px_rgba(15,23,42,0.05)] active:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10",
                active && "border-slate-950 bg-slate-950 text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)]"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function UserMenu({ user }: { user: { name: string; email: string } }) {
  const initials = getInitials(user.name || user.email);

  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1.5 text-sm font-semibold text-slate-800 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10 [&::-webkit-details-marker]:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
          {initials || <UserCircle className="h-4 w-4" aria-hidden />}
        </span>
        <span className="hidden max-w-28 truncate lg:block">{user.name}</span>
        <ChevronDown className="hidden h-4 w-4 text-slate-500 transition group-open:rotate-180 sm:block" aria-hidden />
      </summary>

      <div className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-[min(18rem,calc(100vw-2rem))] rounded-3xl border border-white/70 bg-white/95 p-2 shadow-[0_24px_70px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
        <div className="border-b border-slate-200 px-3 py-3">
          <p className="truncate text-sm font-semibold text-slate-950">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>
        <Link
          href="/settings"
          prefetch={false}
          className="mt-2 flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10"
        >
          <Settings className="h-4 w-4" aria-hidden />
          Ayarlar
        </Link>
        <form action="/api/auth/logout" method="post" className="mt-1">
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-900/10"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Çıkış
          </button>
        </form>
      </div>
    </details>
  );
}

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

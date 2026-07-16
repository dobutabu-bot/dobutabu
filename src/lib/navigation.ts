import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BellRing,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CircleDollarSign,
  FileStack,
  Gauge,
  HandCoins,
  History,
  Landmark,
  PiggyBank,
  ReceiptText,
  Scale,
  Settings,
  Users,
  WalletCards
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: readonly NavItem[];
};

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/clients", label: "Müvekkiller", icon: Users },
  { href: "/cases", label: "Dosyalar", icon: BriefcaseBusiness },
  { href: "/collections", label: "Tahsilatlar", icon: HandCoins },
  { href: "/expenses", label: "Giderler", icon: CircleDollarSign },
  { href: "/cash", label: "Dijital Kasa", icon: WalletCards },
  { href: "/capital", label: "Sermaye", icon: PiggyBank },
  { href: "/bank-statements", label: "Banka Ekstreleri", icon: Landmark },
  { href: "/reconciliation", label: "Mutabakat", icon: Scale },
  { href: "/documents", label: "Belgeler", icon: FileStack },
  { href: "/advances", label: "Avanslar", icon: Banknote },
  { href: "/receipts", label: "Makbuz/Fatura", icon: ReceiptText },
  { href: "/reports", label: "Raporlar", icon: ChartNoAxesCombined },
  { href: "/reminders", label: "Hatırlatmalar", icon: BellRing },
  { href: "/activity", label: "İşlem Geçmişi", icon: History },
  { href: "/settings", label: "Ayarlar", icon: Settings }
] as const satisfies readonly NavItem[];

const groupItems = (hrefs: readonly string[]): readonly NavItem[] =>
  hrefs.flatMap((href) => {
    const item = NAV_ITEMS.find((candidate) => candidate.href === href);
    return item ? [item] : [];
  });

export const NAV_GROUPS: readonly NavGroup[] = [
  { label: "ANA MENÜ", items: groupItems(["/dashboard", "/clients", "/cases", "/documents", "/reports", "/reminders"]) },
  { label: "FİNANS", items: groupItems(["/collections", "/expenses", "/advances", "/cash", "/bank-statements", "/reconciliation", "/receipts", "/capital"]) },
  { label: "AYARLAR", items: groupItems(["/settings"]) }
];

export const FINANCE_NAV_ITEMS = groupItems([
  "/collections",
  "/expenses",
  "/advances",
  "/cash",
  "/bank-statements",
  "/reconciliation",
  "/receipts",
  "/capital"
]);

export const COMPACT_DESKTOP_NAV_ITEMS = groupItems([
  "/dashboard",
  "/clients",
  "/cases",
  "/documents",
  "/reports",
  "/reminders"
]);

export const PRIMARY_MOBILE_NAV_ITEMS: readonly NavItem[] = [
  { ...NAV_ITEMS.find((item) => item.href === "/dashboard")!, label: "Ana Sayfa" },
  NAV_ITEMS.find((item) => item.href === "/clients")!,
  { ...NAV_ITEMS.find((item) => item.href === "/cash")!, label: "Finans" },
  NAV_ITEMS.find((item) => item.href === "/documents")!
];
export const SECONDARY_MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) => !PRIMARY_MOBILE_NAV_ITEMS.some((primary) => primary.href === item.href));
export const MOBILE_MENU_NAV_ITEMS = NAV_ITEMS;

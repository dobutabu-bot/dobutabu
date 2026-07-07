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

const primaryMobileHrefs = ["/dashboard", "/cash", "/collections", "/expenses", "/reports"];

export const PRIMARY_MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) => primaryMobileHrefs.includes(item.href));
export const SECONDARY_MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) => !primaryMobileHrefs.includes(item.href));
export const MOBILE_MENU_NAV_ITEMS = NAV_ITEMS;

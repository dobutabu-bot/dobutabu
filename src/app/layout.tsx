import type { Metadata, Viewport } from "next";

import { OfflineStatusBanner } from "@/components/offline-status-banner";
import { PwaRegister } from "@/components/pwa-register";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Büro Finans Paneli",
  title: {
    default: "Büro Finans Paneli",
    template: "%s | Büro Finans"
  },
  description: "Hukuk bürosu dijital kasa ve finans takip paneli",
  manifest: "/app.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: [
      {
        url: "/pwa-icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png"
      }
    ]
  },
  appleWebApp: {
    capable: true,
    title: "Büro Finans",
    statusBarStyle: "black-translucent"
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Büro Finans",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#08111f"
  }
};

export const viewport: Viewport = {
  themeColor: "#08111f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" data-privacy-mode="off">
      <body>
        <OfflineStatusBanner />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}

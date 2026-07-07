"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function OfflineStatusBanner() {
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setMounted(true);
    setOnline(navigator.onLine);

    function handleOnline() {
      setOnline(true);
    }

    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!mounted || online) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[80] border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 shadow-[0_14px_36px_rgba(120,53,15,0.12)]">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 text-center">
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
        <span>İnternet bağlantısı yok. Veriler güncellenemeyebilir.</span>
      </div>
    </div>
  );
}

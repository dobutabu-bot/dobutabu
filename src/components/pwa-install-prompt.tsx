"use client";

import { CheckCircle2, Download, Info, MonitorDown } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function PwaInstallPrompt() {
  const [mounted, setMounted] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("Tarayıcınız destekliyorsa yükleme butonu burada aktif olur.");

  useEffect(() => {
    setMounted(true);
    setInstalled(isStandaloneMode());

    function handleBeforeInstallPrompt(event: BeforeInstallPromptEvent) {
      event.preventDefault();
      setInstallEvent(event);
      setMessage("Bu tarayıcı doğrudan yüklemeyi destekliyor.");
    }

    function handleAppInstalled() {
      setInstalled(true);
      setInstallEvent(null);
      setMessage("Uygulama yüklendi.");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function installApp() {
    if (!installEvent) {
      setMessage("Bu tarayıcı otomatik yükleme istemi sunmuyor. Aşağıdaki manuel yönergeleri kullanın.");
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    setMessage(choice.outcome === "accepted" ? "Yükleme başlatıldı." : "Yükleme iptal edildi.");
  }

  if (!mounted) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 text-sm text-slate-300">
        Yükleme durumu kontrol ediliyor...
      </div>
    );
  }

  if (installed) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-semibold">Büro Finans PWA olarak çalışıyor.</p>
            <p className="mt-1 text-sm text-emerald-800">Uygulamayı ana ekran, Dock veya uygulama kısayolundan açabilirsiniz.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-950">
            <MonitorDown className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Uygulamayı yükle</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">{message}</p>
          </div>
        </div>
        <button type="button" className="primary-action bg-white text-slate-950 hover:bg-slate-100" onClick={installApp}>
          <Download className="h-4 w-4" aria-hidden />
          Uygulamayı yükle
        </button>
      </div>
      <div className="mt-4 flex gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-xs leading-5 text-slate-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>iPhone Safari ve macOS Safari bazı sürümlerde otomatik buton yerine Paylaş menüsünden ekleme akışı kullanır.</p>
      </div>
    </div>
  );
}

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

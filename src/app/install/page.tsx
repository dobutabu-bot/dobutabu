import type { Metadata } from "next";
import { Apple, Chrome, Compass, MonitorSmartphone, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";

import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { knownLimitations } from "@/lib/system-status";

export const metadata: Metadata = {
  title: "PWA Kurulum",
  description: "Büro Finans Paneli PWA kurulum ve cihaz yönergeleri"
};

const installGuides = [
  {
    title: "macOS Safari",
    icon: Compass,
    steps: ["Safari'de uygulamayı açın.", "Paylaş düğmesine tıklayın.", "Add to Dock / Dock'a Ekle seçeneğini kullanın."]
  },
  {
    title: "iPhone Safari",
    icon: Smartphone,
    steps: ["Safari'de production adresini açın.", "Paylaş düğmesine dokunun.", "Ana Ekrana Ekle seçeneğiyle kısayolu oluşturun."]
  },
  {
    title: "Chrome / Edge Desktop",
    icon: Chrome,
    steps: ["Adres çubuğundaki yükleme ikonunu kontrol edin.", "İkon görünüyorsa Yükle seçeneğini seçin.", "İkon yoksa tarayıcı menüsünden Uygulamayı yükle seçeneğini deneyin."]
  },
  {
    title: "Android Chrome",
    icon: MonitorSmartphone,
    steps: ["Chrome'da uygulama adresini açın.", "Install app / Uygulamayı yükle bildirimi çıkarsa onaylayın.", "Bildirim çıkmazsa üç nokta menüsünden Ana ekrana ekle seçeneğini kullanın."]
  },
  {
    title: "Firefox Desktop",
    icon: ShieldCheck,
    steps: ["Firefox PWA kurulum desteği sınırlı olabilir.", "Uygulamayı normal tarayıcı sekmesinde kullanmaya devam edebilirsiniz.", "Kısayol gerekiyorsa işletim sistemi tarayıcı kısayolunu kullanın."]
  },
  {
    title: "macOS Dock / Masaüstü",
    icon: Apple,
    steps: ["Safari destekliyorsa Dock'a Ekle akışını tercih edin.", "Chrome/Edge kullanıyorsanız uygulama yükleme penceresiyle ayrı uygulama gibi açabilirsiniz.", "Production kullanımda HTTPS alan adı kullanın."]
  }
];

export default function InstallPage() {
  const limitations = knownLimitations();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8" data-testid="page-ready-install">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="surface-dark overflow-hidden p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_420px] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">PWA Kurulum</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-normal text-white sm:text-5xl">
                Büro Finans Paneli her cihazda uygulama gibi açılsın.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                macOS Dock, iPhone ana ekranı, Android ve desktop tarayıcı kurulumları için yönergeler burada.
                PWA kurulmasa bile uygulama normal tarayıcıda çalışmaya devam eder.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/dashboard" className="primary-action bg-white text-slate-950 hover:bg-slate-100">
                  Dashboard ekranına dön
                </Link>
                <Link href="/login" className="secondary-action border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.10]">
                  Giriş ekranı
                </Link>
              </div>
            </div>
            <PwaInstallPrompt />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {installGuides.map((guide) => {
            const Icon = guide.icon;

            return (
              <article key={guide.title} className="surface p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-950">{guide.title}</h2>
                    <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                      {guide.steps.map((step) => (
                        <li key={step} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-950" aria-hidden />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="notice">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Production ortamında PWA install ve tarayıcı bildirimleri için HTTPS gerekir. Hücresel veride hızlı
            açılış için statik kabuk, ikonlar ve Next.js statik dosyaları service worker tarafından cache edilir.
          </p>
        </section>

        <section className="surface p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-950">Şeffaf Kullanım Notları</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Bu notlar bir eksiklik listesi değil; uygulamanın güvenilir ve doğru sınırlar içinde kullanılabilmesi için açıkça paylaşılan ürün kapsamıdır.
              </p>
            </div>
          </div>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {limitations.map((item) => (
              <li key={item} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm leading-6 text-slate-700">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-950" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

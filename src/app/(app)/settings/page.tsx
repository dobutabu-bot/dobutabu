import { Archive, ArchiveRestore, DatabaseBackup, Download, FileSpreadsheet, FileText, MonitorDown, ServerCog, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { BrowserNotificationSettings } from "@/components/browser-notification-settings";
import { EntityForm } from "@/components/entity-form";
import { requireUser } from "@/lib/auth";
import { DEFAULT_DOCUMENT_UPLOAD_LIMIT_MB, documentUploadLimitSettingKey } from "@/lib/document-storage";
import { primaryCsvExports } from "@/lib/export-resources";
import { prisma } from "@/lib/prisma";
import { getFirmSettings } from "@/lib/settings";

const warningText =
  "Yedek dosyalar kişisel veri, müvekkil bilgisi ve finansal bilgi içerebilir. Güvenli yerde saklayınız.";

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings, documentUploadLimitSetting] = await Promise.all([
    getFirmSettings(user.id),
    prisma.appSetting.findUnique({
      where: { userId_key: { userId: user.id, key: documentUploadLimitSettingKey } },
      select: { value: true }
    })
  ]);

  return (
    <div className="space-y-5">
      <EntityForm
        title="Genel Ayarlar"
        endpoint="/api/settings"
        schemaKey="settings"
        submitLabel="Güncelle"
        defaults={{
          firmName: settings.firmName,
          ownerName: settings.ownerName,
          currency: settings.currency
        }}
        fields={[
          { name: "firmName", label: "Büro Adı" },
          { name: "ownerName", label: "Avukat" },
          { name: "currency", label: "Para Birimi" }
        ]}
      />

      <BrowserNotificationSettings />

      <section className="surface p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <ServerCog className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950 sm:text-sm">Sistem Durumu</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Versiyon, database, storage, migration, PWA ve kritik kayıt sağlığını tek ekrandan kontrol edin.
              </p>
            </div>
          </div>
          <Link href="/settings/system-status" className="secondary-action w-full sm:w-auto">
            <ServerCog className="h-4 w-4" aria-hidden />
            Durumu aç
          </Link>
        </div>
      </section>

      <section className="surface p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <SlidersHorizontal className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950 sm:text-sm">Akıllı Kategori Kuralları</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Banka hareketleri için açıklama, IBAN, karşı taraf, tutar aralığı ve regex bazlı sınıflandırma kuralları oluşturun.
              </p>
            </div>
          </div>
          <Link href="/settings/transaction-rules" className="secondary-action w-full sm:w-auto">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Kuralları aç
          </Link>
        </div>
      </section>

      <EntityForm
        title="Belge Merkezi Ayarları"
        endpoint="/api/settings/documents"
        schemaKey="documentSettings"
        submitLabel="Belge Ayarlarını Güncelle"
        defaults={{
          documentMaxUploadSizeMb: documentUploadLimitSetting?.value ?? String(DEFAULT_DOCUMENT_UPLOAD_LIMIT_MB)
        }}
        fields={[
          {
            name: "documentMaxUploadSizeMb",
            label: "Maksimum Dosya Boyutu (MB)",
            type: "number",
            min: "1",
            step: "1",
            hint: "Varsayılan 20 MB. Production ortamında persistent storage ve yedekleme planıyla birlikte düşünülmelidir."
          }
        ]}
        successMessage="Belge ayarları güncellendi."
      />

      <section className="surface p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <FileText className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950 sm:text-sm">Belge Merkezi Güvenliği</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Belgeler public klasöre yazılmaz. Private storage alanından sadece oturum açmış kullanıcıya auth kontrollü route ile servis edilir.
            </p>
          </div>
        </div>
      </section>

      <section className="surface p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <MonitorDown className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950 sm:text-sm">PWA Kurulum</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                macOS Dock, iPhone ana ekranı, Android ve desktop tarayıcı kurulum yönergelerini açın.
              </p>
            </div>
          </div>
          <Link href="/install" className="secondary-action w-full sm:w-auto">
            <MonitorDown className="h-4 w-4" aria-hidden />
            Kurulum ekranı
          </Link>
        </div>
      </section>

      <section className="surface p-4">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <DatabaseBackup className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950 sm:text-sm">Yedekleme ve Dışa Aktarma</h2>
            <p className="mt-1 text-sm text-slate-600">{warningText}</p>
            <p className="mt-1 text-xs text-slate-500">
              Bu bölümdeki yedekler silinen kayıtları da içerir; deletedAt bilgisi korunur.
            </p>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <div className="mb-3 flex items-center gap-2">
              <Archive className="h-4 w-4 text-slate-500" aria-hidden />
              <h3 className="text-sm font-semibold text-slate-950">Toplu export</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <a
                href="/api/export/zip"
                className="primary-action"
              >
                <Download className="h-4 w-4" aria-hidden />
                CSV ZIP yedeği indir
              </a>
              <a
                href="/api/backup"
                className="secondary-action"
              >
                <Download className="h-4 w-4" aria-hidden />
                Tüm verileri JSON olarak dışa aktar
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <div className="mb-3 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-slate-500" aria-hidden />
              <h3 className="text-sm font-semibold text-slate-950">CSV export</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {primaryCsvExports.map((item) => (
                <a
                  key={item.resource}
                  href={`/api/export?resource=${item.resource}&format=csv&includeDeleted=1`}
                  className="secondary-action px-3 py-2"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="surface p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <ArchiveRestore className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950 sm:text-sm">Silinen Kayıtlar</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Yanlışlıkla silinen müvekkil, dosya, tahsilat, gider ve belge kayıtlarını geri alın.
              </p>
            </div>
          </div>
          <Link href="/settings/deleted-records" className="secondary-action w-full sm:w-auto">
            <ArchiveRestore className="h-4 w-4" aria-hidden />
            Silinen kayıtları aç
          </Link>
        </div>
      </section>
    </div>
  );
}

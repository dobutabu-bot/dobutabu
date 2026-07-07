import { AlertTriangle, Archive, DatabaseBackup, Download } from "lucide-react";

const warningText =
  "Yedek dosyalar kişisel veri, müvekkil bilgisi, belge metadata, banka ekstresi satırları ve sermaye/portföy bilgileri içerebilir. Güvenli yerde saklayınız.";

const backups = [
  { href: "/api/backup", title: "JSON Yedek", label: "İndir", icon: DatabaseBackup },
  { href: "/api/export/zip", title: "CSV ZIP Paketi", label: "ZIP indir", icon: Archive },
  { href: "/api/backup/sqlite", title: "SQLite Dosyası", label: "İndir", icon: DatabaseBackup }
];

export default function BackupPage() {
  return (
    <div className="space-y-5">
      <section className="notice">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p>{warningText}</p>
          <p className="text-xs text-slate-500">
            JSON/CSV yedekleri belge metadata içerir; fiziksel dosyalar için private storage klasörünü ayrıca yedekleyin.
          </p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {backups.map((backup) => {
          const Icon = backup.icon;
          return (
            <div key={backup.href} className="surface p-4">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="text-sm font-semibold text-slate-950">{backup.title}</h2>
              </div>
              <a
                href={backup.href}
                className="primary-action w-full"
              >
                <Download className="h-4 w-4" aria-hidden />
                {backup.label}
              </a>
            </div>
          );
        })}
      </section>
    </div>
  );
}

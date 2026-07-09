import {
  Activity,
  AlertTriangle,
  Archive,
  Clock3,
  Database,
  FileArchive,
  FileText,
  HardDrive,
  MonitorDown,
  ServerCog,
  ShieldCheck,
  TriangleAlert,
  Users,
  WalletCards
} from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getSystemStatusData } from "@/lib/system-status";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SystemStatusPage() {
  const user = await requireUser();
  const status = await getSystemStatusData(user.id);

  return (
    <div className="space-y-5">
      <section className="surface-dark overflow-hidden p-5">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">V3-RC1 operasyon paneli</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Sistem Durumu</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Yayına geçmeden önce uygulama, veritabanı, belge storage, PWA ve kritik finans kayıtlarının sağlık özetini tek ekrandan kontrol edin.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={status.health.ok ? "green" : "rose"}>
              {status.health.ok ? "Sistem sağlıklı" : "Kontrol gerekli"}
            </StatusBadge>
            <StatusBadge tone="neutral">{status.releaseName}</StatusBadge>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatusMetric icon={ServerCog} title="Uygulama versiyonu" value={status.version} detail={status.releaseName} />
        <StatusMetric icon={Activity} title="Ortam" value={status.environment} detail="Secret veya URL gösterilmez" />
        <StatusMetric
          icon={Database}
          title="Database"
          value={status.health.database ? "Bağlı" : "Bağlantı yok"}
          detail={status.health.database ? "Sorgu yanıt verdi" : "Veritabanı erişimi kontrol edilmeli"}
          tone={status.health.database ? "green" : "rose"}
        />
        <StatusMetric
          icon={HardDrive}
          title="Belge storage"
          value={status.storage.usedLabel}
          detail={status.storage.ok ? "Private storage erişilebilir" : "Storage klasörü erişilemiyor"}
          tone={status.storage.ok ? "green" : "rose"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="surface p-4">
          <SectionTitle icon={ShieldCheck} title="Çekirdek Sağlık" description="Migration, backup, PWA ve servis dosyaları." />
          <div className="mt-4 grid gap-3">
            <StatusRow
              label="Son migration"
              value={status.migration.name}
              detail={`${status.migration.appliedAt} · adım: ${status.migration.appliedSteps}`}
              ok={status.migration.ok}
            />
            <StatusRow
              label="Son backup"
              value={status.backup.lastBackupAt}
              detail={status.backup.ok ? "Yedek kaydı bulundu" : "Henüz yedek dosyası tespit edilmedi"}
              ok={status.backup.ok}
              warningWhenFalse
            />
            <StatusRow
              label="PWA manifest"
              value={status.pwa.manifest ? "Mevcut" : "Eksik"}
              detail="app.webmanifest kontrolü"
              ok={status.pwa.manifest}
            />
            <StatusRow
              label="Service worker"
              value={status.pwa.serviceWorker ? "Mevcut" : "Eksik"}
              detail="Tarayıcı kayıt durumu cihaza göre değişebilir"
              ok={status.pwa.serviceWorker}
            />
            <StatusRow
              label="Health zamanı"
              value={new Date(status.health.time).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}
              detail="Server-side kontrol zamanı"
              ok={status.health.ok}
            />
          </div>
        </div>

        <div className="surface p-4">
          <SectionTitle icon={Clock3} title="Son Operasyonlar" description="Backup ve banka import takibi." />
          <div className="mt-4 grid gap-3">
            <MiniInfo icon={Archive} title="Son backup zamanı" value={status.backup.lastBackupAt} muted={!status.backup.ok} />
            <MiniInfo icon={FileArchive} title="Son banka import" value={status.bankImport.lastImportAt} detail={status.bankImport.lastImportLabel} muted={!status.bankImport.ok} />
            <MiniInfo icon={MonitorDown} title="PWA durumu" value={status.pwa.manifest && status.pwa.serviceWorker ? "Kuruluma hazır" : "Kontrol gerekli"} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatusMetric icon={Users} title="Müvekkil" value={status.counts.clients.toLocaleString("tr-TR")} detail="Aktif müvekkil sayısı" />
        <StatusMetric icon={WalletCards} title="Tahsilat / Gider" value={`${status.counts.incomes.toLocaleString("tr-TR")} / ${status.counts.expenses.toLocaleString("tr-TR")}`} detail="Silinmemiş finans kayıtları" />
        <StatusMetric icon={FileText} title="Belgeler" value={status.counts.documents.toLocaleString("tr-TR")} detail="Aktif belge metadata kaydı" />
        <StatusMetric
          icon={AlertTriangle}
          title="Kontrol Bekleyen"
          value={status.counts.unmatchedBankRows.toLocaleString("tr-TR")}
          detail="Eşleşmemiş banka hareketi"
          tone={status.counts.unmatchedBankRows > 0 ? "amber" : "green"}
        />
      </section>

      <section className="surface p-4">
        <SectionTitle icon={TriangleAlert} title="Finans Kontrol Uyarıları" description="Yayına hazırlıkta yakından izlenmesi gereken kayıtlar." />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <StatusRow
            label="Eşleşmemiş banka hareketi"
            value={status.counts.unmatchedBankRows.toLocaleString("tr-TR")}
            detail="Mutabakat ekranından incelenebilir"
            ok={status.counts.unmatchedBankRows === 0}
            warningWhenFalse
          />
          <StatusRow
            label="Belgesiz finans kaydı"
            value={status.counts.missingFinancialDocuments.toLocaleString("tr-TR")}
            detail="Belge yükle, mevcut belge bağla veya belge gerekmiyor olarak işaretle"
            ok={status.counts.missingFinancialDocuments === 0}
            warningWhenFalse
          />
        </div>
      </section>

      <section className="surface p-4">
        <SectionTitle icon={TriangleAlert} title="Bilinen Sınırlamalar" description="V3-RC1 kapsamı dışında bırakılan veya production’da dikkat isteyen alanlar." />
        <ul className="mt-4 grid gap-2">
          {status.limitations.map((limitation) => (
            <li key={limitation} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm leading-6 text-slate-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
              <span>{limitation}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description
}: {
  icon: typeof Activity;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function StatusMetric({
  icon: Icon,
  title,
  value,
  detail,
  tone = "neutral"
}: {
  icon: typeof Activity;
  title: string;
  value: string;
  detail: string;
  tone?: "neutral" | "green" | "amber" | "rose";
}) {
  const toneClass = {
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200"
  }[tone];

  return (
    <article className="premium-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label">{title}</p>
          <p className="mt-2 truncate text-2xl font-semibold tabular-finance text-slate-950">{value}</p>
          <p className="mt-2 truncate text-xs text-slate-500">{detail}</p>
        </div>
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 shadow-[0_12px_24px_rgba(15,23,42,0.07)]", toneClass)}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </article>
  );
}

function StatusRow({
  label,
  value,
  detail,
  ok,
  warningWhenFalse = false
}: {
  label: string;
  value: string;
  detail: string;
  ok: boolean;
  warningWhenFalse?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-100 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
      </div>
      <StatusBadge tone={ok ? "green" : warningWhenFalse ? "amber" : "rose"}>
        {ok ? "PASS" : warningWhenFalse ? "İzle" : "FAIL"}
      </StatusBadge>
    </div>
  );
}

function MiniInfo({
  icon: Icon,
  title,
  value,
  detail,
  muted = false
}: {
  icon: typeof Activity;
  title: string;
  value: string;
  detail?: string;
  muted?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border px-3 py-3", muted ? "border-amber-200 bg-amber-50/70" : "border-slate-100 bg-white/80")}>
      <div className="flex items-start gap-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl", muted ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700")}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</p>
          {detail ? <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p> : null}
        </div>
      </div>
    </div>
  );
}

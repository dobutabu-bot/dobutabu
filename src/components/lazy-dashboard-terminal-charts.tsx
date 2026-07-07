"use client";

import { Component, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";

import { ChartSkeleton } from "@/components/charts/chart-frame";
import { EmptyState } from "@/components/empty-state";
import type { DashboardTerminalChartData } from "@/components/dashboard-terminal-charts";

type DashboardChartsComponent = ComponentType<{ data: DashboardTerminalChartData }>;

type BrowserWindowWithIdle = Window &
  typeof globalThis & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

export function LazyDashboardTerminalCharts({ data }: { data: DashboardTerminalChartData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoadCharts, setShouldLoadCharts] = useState(false);
  const [ChartsComponent, setChartsComponent] = useState<DashboardChartsComponent | null>(null);
  const [loadingCharts, setLoadingCharts] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (shouldLoadCharts) return;

    const browserWindow = window as BrowserWindowWithIdle;
    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;
    let observer: IntersectionObserver | undefined;

    const loadCharts = () => {
      if (!cancelled) {
        setShouldLoadCharts(true);
      }
    };

    if ("IntersectionObserver" in window && containerRef.current) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            loadCharts();
            observer?.disconnect();
          }
        },
        { rootMargin: "900px 0px" }
      );
      observer.observe(containerRef.current);
    }

    if (browserWindow.requestIdleCallback) {
      idleHandle = browserWindow.requestIdleCallback(loadCharts, { timeout: 4500 });
    } else {
      timeoutHandle = window.setTimeout(loadCharts, 1800);
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (idleHandle !== undefined) {
        browserWindow.cancelIdleCallback?.(idleHandle);
      }
      if (timeoutHandle) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [shouldLoadCharts]);

  useEffect(() => {
    if (!shouldLoadCharts || ChartsComponent || loadingCharts || loadFailed) return;

    let cancelled = false;
    setLoadingCharts(true);
    setLoadFailed(false);

    import("@/components/dashboard-terminal-charts")
      .then((module) => {
        if (cancelled) return;
        setChartsComponent(() => module.DashboardTerminalCharts);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCharts(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ChartsComponent, loadFailed, loadingCharts, retryKey, shouldLoadCharts]);

  return (
    <div ref={containerRef}>
      {!shouldLoadCharts || loadingCharts ? (
        <DashboardChartsLoading />
      ) : loadFailed || !ChartsComponent ? (
        <DashboardChartsError
          onRetry={() => {
            setChartsComponent(null);
            setLoadFailed(false);
            setRetryKey((current) => current + 1);
          }}
        />
      ) : (
        <DashboardChartsErrorBoundary
          key={retryKey}
          onRetry={() => {
            setChartsComponent(null);
            setLoadFailed(false);
            setRetryKey((current) => current + 1);
          }}
        >
          <ChartsComponent data={data} />
        </DashboardChartsErrorBoundary>
      )}
    </div>
  );
}

type DashboardChartsErrorBoundaryProps = {
  children: ReactNode;
  onRetry: () => void;
};

type DashboardChartsErrorBoundaryState = {
  hasError: boolean;
};

class DashboardChartsErrorBoundary extends Component<
  DashboardChartsErrorBoundaryProps,
  DashboardChartsErrorBoundaryState
> {
  state: DashboardChartsErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <DashboardChartsError onRetry={this.props.onRetry} />;
    }

    return this.props.children;
  }
}

function DashboardChartsError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="surface p-4" aria-label="Dashboard grafikleri yüklenemedi">
      <EmptyState
        title="Grafikler yüklenemedi"
        description="Bağlantı yavaş olabilir. Finans özetleri çalışmaya devam eder; grafikleri yeniden yüklemeyi deneyebilirsiniz."
      />
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2"
        >
          Grafikleri tekrar yükle
        </button>
      </div>
    </section>
  );
}

function DashboardChartsLoading() {
  const cards = [
    { title: "Son 7 Gün Kasa Giriş/Çıkış", description: "Kısa dönem dijital kasa nabzı", className: "xl:col-span-5" },
    { title: "Bu Ay Günlük Nakit Akışı", description: "Gün gün net kasa akışı", className: "xl:col-span-7" },
    { title: "Gelir/Gider Karşılaştırma", description: "Son 6 ayın aylık karşılaştırması", className: "xl:col-span-5" },
    { title: "En Yüksek 5 Müvekkil Bakiyesi", description: "Açık bakiye yoğunluğu", className: "xl:col-span-4" },
    { title: "Kasa Hesap Dağılımı", description: "Hesap bazlı bakiye kompozisyonu", className: "xl:col-span-4" },
    { title: "Gider Kategorileri", description: "Bu ay kategori dağılımı", className: "xl:col-span-3" }
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-12" aria-label="Dashboard grafikleri yükleniyor">
      {cards.map((card) => (
        <ChartSkeleton key={card.title} title={card.title} description={card.description} className={card.className} />
      ))}
    </section>
  );
}

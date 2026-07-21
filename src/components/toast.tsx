"use client";

import { CheckCircle2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const toastEventName = "law-finance-toast";
const queuedToastKey = "law-finance-toast-message";

type ToastEventDetail = {
  message: string;
};

export function showToast(message: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<ToastEventDetail>(toastEventName, { detail: { message } }));
}

export function queueToast(message: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(queuedToastKey, message);
}

export function ToastViewport() {
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearToastTimer() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }

    function openToast(nextMessage: string) {
      clearToastTimer();
      setMessage(nextMessage);
      timeoutRef.current = setTimeout(() => setMessage(null), 3600);
    }

    function onToast(event: Event) {
      const detail = (event as CustomEvent<ToastEventDetail>).detail;
      if (detail?.message) {
        openToast(detail.message);
      }
    }

    const queuedMessage = window.sessionStorage.getItem(queuedToastKey);
    if (queuedMessage) {
      window.sessionStorage.removeItem(queuedToastKey);
      openToast(queuedMessage);
    }

    window.addEventListener(toastEventName, onToast);
    setReady(true);

    return () => {
      clearToastTimer();
      window.removeEventListener(toastEventName, onToast);
    };
  }, []);

  if (!message) {
    return <span className="hidden" data-toast-ready={ready ? "true" : "false"} aria-hidden />;
  }

  return (
    <div
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[70] flex justify-center lg:bottom-5 lg:left-auto lg:right-5 lg:justify-end"
      data-toast-ready={ready ? "true" : "false"}
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-sm items-start gap-3 rounded-xl border border-emerald-200 bg-white p-3 text-sm text-slate-800 shadow-2xl">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
        <p className="min-w-0 flex-1 leading-6">{message}</p>
        <button type="button" className="icon-button h-8 w-8 shrink-0" aria-label="Bildirimi kapat" onClick={() => setMessage(null)}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

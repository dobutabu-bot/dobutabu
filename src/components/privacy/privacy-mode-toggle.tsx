"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  applyPrivacyModeToDocument,
  privacyModeEvent,
  readStoredPrivacyPreference,
  writeStoredPrivacyPreference
} from "@/lib/ui/privacy";

export function PrivacyModeToggle() {
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const savedValue = readStoredPrivacyPreference(window.localStorage);
    setEnabled(savedValue);
    applyPrivacyModeToDocument(document, savedValue);
    window.dispatchEvent(privacyModeEvent(savedValue));
    setMounted(true);

    return () => {
      applyPrivacyModeToDocument(document, false);
      window.dispatchEvent(privacyModeEvent(false));
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    writeStoredPrivacyPreference(window.localStorage, enabled);
    applyPrivacyModeToDocument(document, enabled);
    window.dispatchEvent(privacyModeEvent(enabled));
  }, [enabled, mounted]);

  const Icon = enabled ? EyeOff : Eye;

  return (
    <button
      type="button"
      className={cn(
        "icon-button",
        enabled && "bg-slate-950 text-white hover:bg-slate-900",
        !mounted && "cursor-wait opacity-60"
      )}
      aria-label={enabled ? "Tutarları göster" : "Tutarları gizle"}
      aria-pressed={mounted ? enabled : false}
      disabled={!mounted}
      title={enabled ? "Gizlilik modu açık" : "Tutarları gizle"}
      data-testid="privacy-mode-toggle"
      data-mounted={mounted ? "true" : "false"}
      onClick={() => setEnabled((value) => !value)}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

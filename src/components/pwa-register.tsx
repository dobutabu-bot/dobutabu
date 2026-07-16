"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void clearDevelopmentPwaState();

      return;
    }

    let reloading = false;
    const handleControllerChange = () => {
      if (reloading) {
        return;
      }

      reloading = true;
      window.location.reload();
    };

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
          return registration.update();
        })
        .catch(() => undefined);
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
    }

    return () => {
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return null;
}

async function clearDevelopmentPwaState() {
  const wasControlled = Boolean(navigator.serviceWorker.controller);
  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
  await Promise.allSettled(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const keys = await window.caches.keys().catch(() => []);
    await Promise.allSettled(keys.map((key) => window.caches.delete(key)));
  }

  const reloadKey = "buro-finans-dev-pwa-cleanup-v1";
  if (wasControlled && window.sessionStorage.getItem(reloadKey) !== "done") {
    window.sessionStorage.setItem(reloadKey, "done");
    window.location.reload();
  }
}

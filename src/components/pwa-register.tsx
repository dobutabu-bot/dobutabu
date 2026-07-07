"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => undefined);
        });
      });

      if ("caches" in window) {
        window.caches.keys().then((keys) => {
          keys.forEach((key) => {
            window.caches.delete(key).catch(() => undefined);
          });
        });
      }

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

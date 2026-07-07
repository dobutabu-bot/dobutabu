export const appDataMutationEvent = "buro-finans-data-mutated";
export const appDataMutationStorageKey = "buro-finans-data-mutated-at";

export function emitAppDataMutation(reason = "data-change") {
  if (typeof window === "undefined") {
    return;
  }

  const payload = { reason, at: Date.now() };
  window.dispatchEvent(new CustomEvent(appDataMutationEvent, { detail: payload }));

  try {
    window.localStorage.setItem(appDataMutationStorageKey, JSON.stringify(payload));
  } catch {
    // Cross-tab sync is best effort; same-tab refresh still works through the custom event.
  }
}

export function subscribeAppDataMutation(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const onMutation = () => callback();
  const onStorage = (event: StorageEvent) => {
    if (event.key === appDataMutationStorageKey) {
      callback();
    }
  };

  window.addEventListener(appDataMutationEvent, onMutation);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(appDataMutationEvent, onMutation);
    window.removeEventListener("storage", onStorage);
  };
}

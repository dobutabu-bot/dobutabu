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

export function subscribeAppDataMutation(callback: () => void, options: { includeSameTab?: boolean } = {}) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const includeSameTab = options.includeSameTab ?? true;
  const onMutation = () => callback();
  const onStorage = (event: StorageEvent) => {
    if (event.key === appDataMutationStorageKey) {
      callback();
    }
  };

  if (includeSameTab) {
    window.addEventListener(appDataMutationEvent, onMutation);
  }
  window.addEventListener("storage", onStorage);

  return () => {
    if (includeSameTab) {
      window.removeEventListener(appDataMutationEvent, onMutation);
    }
    window.removeEventListener("storage", onStorage);
  };
}

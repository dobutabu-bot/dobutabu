export const readNotificationStorageKey = "buro-finans-read-notification-ids";
export const readNotificationChangeEvent = "buro-finans-read-notifications-changed";

export function readNotificationIds() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(readNotificationStorageKey);
    const parsedValue = storedValue ? JSON.parse(storedValue) : [];

    return Array.isArray(parsedValue)
      ? parsedValue.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeReadNotificationIds(ids: string[]) {
  if (typeof window === "undefined") {
    return [];
  }

  const uniqueIds = Array.from(new Set(ids));

  try {
    window.localStorage.setItem(readNotificationStorageKey, JSON.stringify(uniqueIds));
  } catch {
    // Okundu bilgisi yardımcı bir UI state'idir; storage kapalıysa ana akışı kesmez.
  }

  window.dispatchEvent(new CustomEvent(readNotificationChangeEvent, { detail: uniqueIds }));
  return uniqueIds;
}

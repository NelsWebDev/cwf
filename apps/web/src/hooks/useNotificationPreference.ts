import { useSyncExternalStore } from "react";

const NOTIFICATIONS_KEY = "cwf-notifications";
const SOUNDS_KEY = "cwf-notification-sounds";
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const write = (key: string, enabled: boolean) => {
  localStorage.setItem(key, String(enabled));
  listeners.forEach((l) => l());
};

export const getNotificationPreference = () => localStorage.getItem(NOTIFICATIONS_KEY) === "true";
// Sounds default to on; they only take effect while notifications are enabled.
export const getNotificationSoundPreference = () =>
  getNotificationPreference() && localStorage.getItem(SOUNDS_KEY) !== "false";

export const setNotificationPreference = (enabled: boolean) => write(NOTIFICATIONS_KEY, enabled);
export const setNotificationSoundPreference = (enabled: boolean) => write(SOUNDS_KEY, enabled);

export const useNotificationPreference = () => useSyncExternalStore(subscribe, getNotificationPreference);
export const useNotificationSoundPreference = () => useSyncExternalStore(subscribe, getNotificationSoundPreference);

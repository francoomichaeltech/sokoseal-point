import { useSyncExternalStore } from "react";
import { messages, type Locale } from "./messages";

const STORAGE_KEY = "sokoseal.locale";
const listeners = new Set<() => void>();

function readLocale(): Locale {
  return localStorage.getItem(STORAGE_KEY) === "sw" ? "sw" : "en";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keeps other open tabs in sync.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function setLocale(locale: Locale) {
  localStorage.setItem(STORAGE_KEY, locale);
  listeners.forEach((listener) => listener());
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, readLocale, () => "en");
}

export function useMessages() {
  return messages[useLocale()];
}
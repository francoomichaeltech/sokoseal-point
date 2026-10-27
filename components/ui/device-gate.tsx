"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useLocale } from "@/lib/i18n/locale";
import { DesktopHandoff } from "./desktop-handoff";

// Desktop = wide screen with a mouse. Tablets and phones (coarse pointer) get the app.
const DESKTOP_QUERY = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function DeviceGate({ children }: { children: ReactNode }) {
  const isDesktop = useSyncExternalStore<boolean | null>(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    // Device type is unknown on the server; render nothing rather than the wrong experience.
    () => null,
  );
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  if (isDesktop === null) return null;
  return isDesktop ? <DesktopHandoff /> : children;
}
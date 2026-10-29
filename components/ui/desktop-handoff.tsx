"use client";

import { QRCodeSVG } from "qrcode.react";
import { useMessages } from "@/lib/i18n/locale";
import { LanguageSwitch } from "./language-switch";
import { Wordmark } from "./wordmark";

export function DesktopHandoff() {
  const t = useMessages().handoff;
  // Only rendered on the client (see DeviceGate), so window is available.
  const { origin, host } = window.location;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="shrink-0 border-b border-line bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4 sm:px-12">
          <Wordmark />
          <LanguageSwitch />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-8">
        <section className="grid w-full max-w-4xl grid-cols-[1fr_auto] items-center gap-12 rounded-card border border-line bg-surface p-12 shadow-card">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
            <p className="mt-3 max-w-md text-lg text-muted">{t.body}</p>

            <ol className="mt-8 space-y-3">
              {t.steps.map((step, index) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <p className="mt-8 text-sm text-muted">{t.footer}</p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="rounded-card border border-line p-5">
              <QRCodeSVG value={origin} size={220} marginSize={0} title={host} />
            </div>
            <p className="text-sm font-medium">{host}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
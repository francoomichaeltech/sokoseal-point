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
      <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-8">
        <Wordmark />
        <LanguageSwitch />
      </header>

      <main className="flex flex-1 items-center justify-center p-8">
        <section className="w-full max-w-md rounded-card border border-line bg-surface p-10 text-center shadow-card">
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="mt-2 text-muted">{t.body}</p>

          <div className="mx-auto mt-8 w-fit rounded-control border border-line p-4">
            <QRCodeSVG value={origin} size={192} marginSize={0} title={host} />
          </div>
          <p className="mt-3 text-sm font-medium">{host}</p>

          <ol className="mx-auto mt-8 w-fit space-y-2 text-left">
            {t.steps.map((step, index) => (
              <li key={step}>
                {index + 1}. {step}
              </li>
            ))}
          </ol>

          <p className="mt-8 border-t border-line pt-6 text-sm text-muted">{t.footer}</p>
        </section>
      </main>
    </div>
  );
}
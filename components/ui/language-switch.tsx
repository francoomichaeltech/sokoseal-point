"use client";

import { setLocale, useLocale } from "@/lib/i18n/locale";
import type { Locale } from "@/lib/i18n/messages";

// Language names are always shown in their own language.
const options: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "sw", label: "Kiswahili" },
];

export function LanguageSwitch() {
  const locale = useLocale();

  return (
    <div
      role="radiogroup"
      aria-label="Language"
      className="inline-flex rounded-control border border-line bg-surface p-0.5"
    >
      {options.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={locale === code}
          onClick={() => setLocale(code)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            locale === code ? "bg-primary text-white" : "text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
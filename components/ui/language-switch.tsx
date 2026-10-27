"use client";

import { setLocale, useLocale } from "@/lib/i18n/locale";
import type { Locale } from "@/lib/i18n/messages";

// Language names are always shown in their own language.
const options: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "sw", label: "Kiswahili" },
];

type LanguageSwitchProps = {
  block?: boolean;
  className?: string;
};

export function LanguageSwitch({ block = false, className = "" }: LanguageSwitchProps) {
  const locale = useLocale();

  return (
    <div
      role="radiogroup"
      aria-label="Language"
      className={`${block ? "flex w-full" : "inline-flex"} rounded-control border border-line bg-surface p-0.5 ${className}`}
    >
      {options.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={locale === code}
          onClick={() => setLocale(code)}
          className={`${block ? "h-11 flex-1" : "py-1.5"} rounded-lg px-3 text-sm font-medium ${
            locale === code ? "bg-primary text-white" : "text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
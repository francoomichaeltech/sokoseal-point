"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { AppHeader } from "@/components/ui/app-header";
import { LanguageSwitch } from "@/components/ui/language-switch";
import { useMessages } from "@/lib/i18n/locale";
import { CURRENCIES, type Currency } from "@/lib/money";
import { shopStore, useShop } from "@/lib/shop/store";

const NAME_MAX_LENGTH = 60;

export default function SetupPage() {
  const router = useRouter();
  const shop = useShop();
  const t = useMessages().setup;

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [submitted, setSubmitted] = useState(false);

  // Setup runs once. Saving the shop also triggers this redirect.
  useEffect(() => {
    if (shop) router.replace("/products");
  }, [shop, router]);

  if (shop !== null) return null;

  const trimmedName = name.trim();
  const nameError = submitted && !trimmedName;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (trimmedName) shopStore.set({ name: trimmedName, currency });
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex min-h-[calc(100dvh-var(--header-height))] max-w-md flex-col px-4 pt-6 pb-safe">
        <h1 className="text-2xl font-bold">{t.title}</h1>

        <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-1 flex-col gap-6">
          <div>
            <label htmlFor="shop-name" className="text-sm font-semibold">
              {t.shopName}
            </label>
            {/* 16px text stops iOS Safari from zooming into the field on focus. */}
            <input
              id="shop-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={NAME_MAX_LENGTH}
              autoComplete="organization"
              placeholder={t.shopNamePlaceholder}
              aria-invalid={nameError}
              aria-describedby={nameError ? "shop-name-error" : undefined}
              className="mt-2 h-12 w-full rounded-control border border-line bg-surface px-3 text-base focus:border-primary"
            />
            {nameError && (
              <p id="shop-name-error" className="mt-1.5 text-sm text-danger">
                {t.nameRequired}
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold">{t.language}</p>
            <LanguageSwitch block className="mt-2" />
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">{t.currency}</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {CURRENCIES.map((code) => {
                const selected = currency === code;

                return (
                  <label
                    key={code}
                    className={`relative flex cursor-pointer flex-col rounded-card border p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                      selected ? "border-primary bg-primary-soft" : "border-line bg-surface"
                    }`}
                  >
                    <input
                      type="radio"
                      name="currency"
                      value={code}
                      checked={selected}
                      onChange={() => setCurrency(code)}
                      className="sr-only"
                    />
                    <span className="text-lg font-bold">{code}</span>
                    <span className="text-sm text-muted">{t.currencies[code]}</span>
                    <span
                      aria-hidden
                      className={`absolute top-3 right-3 grid size-5 place-items-center rounded-full border ${
                        selected ? "border-primary bg-primary text-white" : "border-line"
                      }`}
                    >
                      {selected && <Check size={14} strokeWidth={3} />}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-muted">{t.currencyHelp}</p>
          </fieldset>

          <button
            type="submit"
            className="mt-auto mb-4 h-12 w-full rounded-card bg-primary font-semibold text-white"
          >
            {t.submit}
          </button>
        </form>
      </main>
    </>
  );
}
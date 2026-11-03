"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Check, Download, Lock, Upload } from "lucide-react";
import { useProducts } from "@/lib/catalogue/store";
import { applyCatalogueBundle, exportCatalogueBundle, validateCatalogueJson } from "@/lib/catalogue/transfer";
import { LanguageSwitch } from "@/components/ui/language-switch";
import { useMessages } from "@/lib/i18n/locale";
import { CURRENCIES, type Currency } from "@/lib/money";
import { shopStore, useShop } from "@/lib/shop/store";

const NAME_MAX_LENGTH = 60;

export default function SettingsPage() {
  const shop = useShop();
  const products = useProducts();
  const messages = useMessages();
  const t = messages.settings;
  const setupT = messages.setup;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameError, setNameError] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [transferNotice, setTransferNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  if (!shop || products === undefined) {
    return (
      <div className="flex flex-col gap-6 py-2" aria-busy="true">
        <div className="h-8 w-32 rounded-control bg-line/60" />
        <div className="h-36 rounded-card border border-line bg-surface p-4" />
        <div className="h-28 rounded-card border border-line bg-surface p-4" />
        <div className="h-44 rounded-card border border-line bg-surface p-4" />
      </div>
    );
  }

  const currentName = nameDraft ?? shop.name;
  const hasProducts = products.length > 0;

  function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shop) return;
    const trimmed = currentName.trim();
    if (!trimmed) {
      setNameError(true);
      setSavedNotice(false);
      return;
    }
    setNameError(false);
    shopStore.set({ name: trimmed, currency: shop.currency });
    setNameDraft(null);
    setSavedNotice(true);
  }

  function handleCurrencyChange(nextCurrency: Currency) {
    if (!shop || hasProducts) return;
    shopStore.set({ name: shop.name, currency: nextCurrency });
    setSavedNotice(true);
  }

  async function handleExport() {
    if (!products) return;
    setTransferNotice(null);
    const bundle = await exportCatalogueBundle(products);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "sokoseal-catalogue.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !shop) return;

    try {
      const rawText = await file.text();
      const validation = validateCatalogueJson(rawText, shop.currency);
      if (!validation.ok) {
        setTransferNotice({
          kind: "error",
          text:
            validation.reason === "currency_mismatch"
              ? t.importCurrencyError(shop.currency)
              : t.importInvalid,
        });
        return;
      }

      const count = await applyCatalogueBundle(validation.bundle);
      setTransferNotice({ kind: "ok", text: t.imported(count) });
    } catch {
      setTransferNotice({ kind: "error", text: t.importInvalid });
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <h1 className="text-2xl font-bold">{t.title}</h1>

      <form onSubmit={handleNameSubmit} noValidate className="rounded-card border border-line bg-surface p-4">
        <label htmlFor="settings-shop-name" className="text-sm font-semibold">
          {t.shopName}
        </label>
        <input
          id="settings-shop-name"
          value={currentName}
          onChange={(event) => {
            setNameDraft(event.target.value);
            setNameError(false);
            setSavedNotice(false);
          }}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="organization"
          placeholder={t.shopNamePlaceholder}
          aria-invalid={nameError}
          aria-describedby={nameError ? "settings-shop-name-error" : undefined}
          className="mt-2 h-12 w-full rounded-control border border-line bg-canvas px-3 text-base focus:border-primary"
        />
        {nameError && (
          <p id="settings-shop-name-error" className="mt-1.5 text-sm text-danger">
            {t.nameRequired}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="submit"
            className="h-11 rounded-control bg-primary px-4 text-sm font-semibold text-white"
          >
            {t.saveName}
          </button>
          {savedNotice && (
            <span role="status" className=" inline-flex items-center gap-1.5 text-sm font-medium text-verified">
              <Check aria-hidden size={16} strokeWidth={2.5} />
              {t.saved}
            </span>
          )}
        </div>
      </form>

      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">{t.language}</h2>
        <LanguageSwitch block className="mt-2" />
        <p className="mt-2 text-sm text-muted">{t.languageHelp}</p>
      </section>

      <fieldset disabled={hasProducts} className="rounded-card border border-line bg-surface p-4">
        <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold">
          <span>{t.currency}</span>
          {hasProducts && <Lock aria-hidden size={14} className="text-muted" />}
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {CURRENCIES.map((code) => {
            const selected = shop.currency === code;

            return (
              <label
                key={code}
                className={`relative flex flex-col rounded-card border p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                  hasProducts ? "cursor-not-allowed opacity-75" : "cursor-pointer"
                } ${selected ? "border-primary bg-primary-soft" : "border-line bg-canvas"}`}
              >
                <input
                  type="radio"
                  name="shop-currency"
                  value={code}
                  checked={selected}
                  disabled={hasProducts}
                  onChange={() => handleCurrencyChange(code)}
                  className="sr-only"
                />
                <span className="text-lg font-bold">{code}</span>
                <span className="text-sm text-muted">{setupT.currencies[code]}</span>
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
        <p className="mt-2 text-sm text-muted">
          {hasProducts ? t.currencyLockedHelp : t.currencyUnlockedHelp}
        </p>
      </fieldset>

      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">{t.catalogue}</h2>
        <p className="mt-1 text-sm text-muted">{t.catalogueHelp}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={!hasProducts}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-line bg-canvas px-3 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download aria-hidden size={16} />
            {t.exportBtn}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-line bg-canvas px-3 text-sm font-semibold text-ink"
          >
            <Upload aria-hidden size={16} />
            {t.importBtn}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(event) => void handleImportChange(event)}
            className="sr-only"
            aria-label={t.importBtn}
          />
        </div>
        {transferNotice && (
          <p
            role="status"
            className={`mt-3 text-sm font-medium ${
              transferNotice.kind === "ok" ? "text-verified" : "text-danger"
            }`}
          >
            {transferNotice.text}
          </p>
        )}
      </section>
    </div>
  );
}

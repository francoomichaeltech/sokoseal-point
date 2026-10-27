"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { deletePhotos, preparePhoto, savePhoto } from "@/lib/catalogue/photos";
import { removeProduct, upsertProduct, useProducts } from "@/lib/catalogue/store";
import type { Product } from "@/lib/catalogue/types";
import { useMessages } from "@/lib/i18n/locale";
import { currencyPrefix, parsePrice, priceToInput, type Currency } from "@/lib/money";
import { ProductPhoto } from "./product-photo";

const MAX_PHOTOS = 5;
const MAX_ALIASES = 10;
const NAME_MAX_LENGTH = 60;
const ALIAS_MAX_LENGTH = 40;
const HINT_MAX_LENGTH = 120;
const SKU_PATTERN = /^[A-Z0-9-]{1,20}$/;

// A draft with a blob was picked in this session and is not in IndexedDB yet.
type PhotoDraft = { id: string; blob?: Blob };

type ProductFormProps = {
  product?: Product;
  currency: Currency;
};

function inputClass(invalid: boolean) {
  return `mt-2 h-12 w-full rounded-control border bg-surface px-3 text-base focus:border-primary ${
    invalid ? "border-danger" : "border-line"
  }`;
}

// Adds comma-separated aliases, skipping blanks and case-insensitive duplicates.
function mergeAliases(current: string[], raw: string): string[] {
  const next = [...current];
  for (const part of raw.split(",")) {
    const value = part.trim().slice(0, ALIAS_MAX_LENGTH);
    const duplicate = next.some((alias) => alias.toLowerCase() === value.toLowerCase());
    if (value && !duplicate && next.length < MAX_ALIASES) next.push(value);
  }
  return next;
}

function Field({
  id,
  label,
  error,
  help,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : (
        help && <p className="mt-1.5 text-sm text-muted">{help}</p>
      )}
    </div>
  );
}

export function ProductForm({ product, currency: shopCurrency }: ProductFormProps) {
  const router = useRouter();
  const products = useProducts() ?? [];
  const t = useMessages().productForm;
  // An existing product keeps the currency it was priced in.
  const currency = product?.currency ?? shopCurrency;

  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [price, setPrice] = useState(product ? priceToInput(product.price, product.currency) : "");
  const [aliases, setAliases] = useState<string[]>(product?.aliases ?? []);
  const [aliasInput, setAliasInput] = useState("");
  const [visualHint, setVisualHint] = useState(product?.visualHint ?? "");
  const [active, setActive] = useState(product?.active ?? true);
  const [photos, setPhotos] = useState<PhotoDraft[]>(
    () => product?.referenceImages.map((id) => ({ id })) ?? [],
  );

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const trimmedName = name.trim();
  const normalizedSku = sku.trim().toUpperCase();
  const amount = parsePrice(price, currency);
  const skuTaken = products.some((item) => item.id !== product?.id && item.sku === normalizedSku);

  const errors = {
    name: trimmedName ? null : t.errors.name,
    sku: !SKU_PATTERN.test(normalizedSku) ? t.errors.sku : skuTaken ? t.errors.skuTaken : null,
    price: amount === null ? t.errors.price(currency) : null,
    photos: photos.length > 0 ? null : t.errors.photos,
  };
  const visibleError = (error: string | null) => (submitted ? error : null);

  function commitAliases(raw: string) {
    setAliases((current) => mergeAliases(current, raw));
    setAliasInput("");
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    // Copied synchronously because the caller resets the input right after this call.
    const selected = Array.from(files).slice(0, MAX_PHOTOS - photos.length);

    try {
      const prepared = await Promise.all(selected.map(preparePhoto));
      setPhotos((current) =>
        [...current, ...prepared.map((blob) => ({ id: crypto.randomUUID(), blob }))].slice(0, MAX_PHOTOS),
      );
      setPhotoError(false);
    } catch {
      setPhotoError(true);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (amount === null || Object.values(errors).some(Boolean)) return;

    setSaving(true);
    setSaveError(false);

    try {
      // New photos are written first so a saved product never references a missing image.
      for (const photo of photos) {
        if (photo.blob) await savePhoto(photo.id, photo.blob);
      }

      const keptIds = new Set(photos.map((photo) => photo.id));
      const removedIds = product?.referenceImages.filter((id) => !keptIds.has(id)) ?? [];

      upsertProduct({
        id: product?.id ?? crypto.randomUUID(),
        sku: normalizedSku,
        name: trimmedName,
        price: amount,
        currency,
        aliases: mergeAliases(aliases, aliasInput),
        referenceImages: photos.map((photo) => photo.id),
        visualHint: visualHint.trim() || undefined,
        active,
      });

      await deletePhotos(removedIds);
      router.push("/products");
    } catch {
      setSaveError(true);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!product) return;
    router.replace("/products");
    await removeProduct(product.id);
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t.back}
          onClick={() => router.push("/products")}
          className="tap-target -ml-2 grid place-items-center rounded-full"
        >
          <ArrowLeft aria-hidden size={22} />
        </button>
        <h1 className="text-xl font-bold">{product ? t.editTitle : t.addTitle}</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-5">
        <Field id="product-name" label={t.name} error={visibleError(errors.name)}>
          <input
            id="product-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={NAME_MAX_LENGTH}
            placeholder={t.namePlaceholder}
            aria-invalid={Boolean(visibleError(errors.name))}
            className={inputClass(Boolean(visibleError(errors.name)))}
          />
        </Field>

        <Field id="product-sku" label={t.sku} error={visibleError(errors.sku)} help={t.skuHelp}>
          <input
            id="product-sku"
            value={sku}
            onChange={(event) => setSku(event.target.value.toUpperCase())}
            maxLength={20}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t.skuPlaceholder}
            aria-invalid={Boolean(visibleError(errors.sku))}
            className={inputClass(Boolean(visibleError(errors.sku)))}
          />
        </Field>

        <Field
          id="product-price"
          label={t.price}
          error={visibleError(errors.price)}
          help={t.priceHelp(currency)}
        >
          <div
            className={`mt-2 flex h-12 items-center overflow-hidden rounded-control border bg-surface focus-within:border-primary ${
              visibleError(errors.price) ? "border-danger" : "border-line"
            }`}
          >
            <span className="flex h-full items-center border-r border-line bg-canvas px-3 text-sm font-medium text-muted">
              {currencyPrefix(currency)}
            </span>
            <input
              id="product-price"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              inputMode={currency === "TZS" ? "numeric" : "decimal"}
              placeholder={currency === "TZS" ? "6000" : "5.00"}
              aria-invalid={Boolean(visibleError(errors.price))}
              className="h-full min-w-0 flex-1 px-3 text-base outline-none"
            />
          </div>
        </Field>

        <Field id="product-aliases" label={t.aliases} help={t.aliasesHelp}>
          {aliases.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {aliases.map((alias) => (
                <li
                  key={alias}
                  className="flex items-center gap-1 rounded-full bg-disabled py-1 pr-1 pl-3 text-sm"
                >
                  {alias}
                  <button
                    type="button"
                    aria-label={t.removeAlias(alias)}
                    onClick={() => setAliases((current) => current.filter((item) => item !== alias))}
                    className="grid size-6 place-items-center rounded-full text-muted"
                  >
                    <X aria-hidden size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            id="product-aliases"
            value={aliasInput}
            onChange={(event) => {
              const value = event.target.value;
              if (value.includes(",")) commitAliases(value);
              else setAliasInput(value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                // Enter adds the alias instead of submitting the form.
                event.preventDefault();
                commitAliases(aliasInput);
              }
            }}
            onBlur={() => commitAliases(aliasInput)}
            disabled={aliases.length >= MAX_ALIASES}
            maxLength={ALIAS_MAX_LENGTH}
            enterKeyHint="done"
            placeholder={t.aliasesPlaceholder}
            className={inputClass(false)}
          />
        </Field>

        <Field id="product-hint" label={t.visualHint}>
          <input
            id="product-hint"
            value={visualHint}
            onChange={(event) => setVisualHint(event.target.value)}
            maxLength={HINT_MAX_LENGTH}
            placeholder={t.visualHintPlaceholder}
            className={inputClass(false)}
          />
        </Field>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p id="product-active-label" className="text-sm font-semibold">
              {t.active}
            </p>
            <p className="mt-0.5 text-sm text-muted">{t.activeHelp}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            aria-labelledby="product-active-label"
            onClick={() => setActive((value) => !value)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              active ? "bg-primary" : "bg-line"
            }`}
          >
            <span
              aria-hidden
              className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow-card transition-transform ${
                active ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold">{t.photos}</legend>
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {photos.map((photo, index) => (
              <li key={photo.id} className="relative aspect-square">
                <ProductPhoto
                  source={photo.blob ?? photo.id}
                  alt={t.photoAlt(index + 1)}
                  className="h-full w-full"
                />
                <button
                  type="button"
                  aria-label={t.removePhoto}
                  onClick={() => setPhotos((current) => current.filter((item) => item.id !== photo.id))}
                  className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-ink/70 text-white"
                >
                  <X aria-hidden size={14} />
                </button>
              </li>
            ))}

            {photos.length < MAX_PHOTOS && (
              <li className="aspect-square">
                <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-control border-2 border-dashed border-line text-sm font-medium text-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
                  <Plus aria-hidden size={20} />
                  {t.addPhoto}
                  {/* No capture attribute, so phones offer both camera and gallery. */}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      void addPhotos(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
              </li>
            )}
          </ul>

          {visibleError(errors.photos) ? (
            <p className="mt-1.5 text-sm text-danger">{errors.photos}</p>
          ) : photoError ? (
            <p className="mt-1.5 text-sm text-danger">{t.photoError}</p>
          ) : (
            <p className="mt-1.5 text-sm text-muted">{t.photosHelp(photos.length, MAX_PHOTOS)}</p>
          )}
        </fieldset>

        {saveError && (
          <p role="alert" className="text-sm text-danger">
            {t.saveError}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="h-12 flex-1 rounded-card bg-primary font-semibold text-white disabled:opacity-60"
          >
            {saving ? t.saving : t.save}
          </button>
          <button
            type="button"
            onClick={() => router.push("/products")}
            className="h-12 flex-1 rounded-card border border-line bg-surface font-semibold"
          >
            {t.cancel}
          </button>
        </div>

        {product && (
          <div className="border-t border-line pt-5">
            {confirmDelete ? (
              <div role="alertdialog" aria-labelledby="delete-confirm" className="rounded-card border border-danger/40 p-4">
                <p id="delete-confirm" className="text-sm font-medium">
                  {t.deleteConfirm}
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="h-11 flex-1 rounded-card bg-danger font-semibold text-white"
                  >
                    {t.deleteYes}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="h-11 flex-1 rounded-card border border-line bg-surface font-semibold"
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-card text-sm font-semibold text-danger"
              >
                <Trash2 aria-hidden size={16} />
                {t.delete}
              </button>
            )}
          </div>
        )}
      </form>
    </>
  );
}
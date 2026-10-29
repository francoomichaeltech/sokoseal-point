"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, ImagePlus, X } from "lucide-react";
import { deletePhotos, preparePhoto, savePhoto } from "@/lib/catalogue/photos";
import { suggestSku } from "@/lib/catalogue/sku";
import { upsertProduct, useProducts } from "@/lib/catalogue/store";
import type { Product } from "@/lib/catalogue/types";
import { useMessages } from "@/lib/i18n/locale";
import { currencyPrefix, parsePrice, priceToInput, type Currency } from "@/lib/money";
import { ProductPhoto } from "./product-photo";

const MAX_PHOTOS = 5;
const NAME_MAX_LENGTH = 60;
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
  // null: a new product's SKU follows the name until the merchant types their own.
  const [skuInput, setSkuInput] = useState<string | null>(product?.sku ?? null);
  const [price, setPrice] = useState(product ? priceToInput(product.price, product.currency) : "");
  const [photos, setPhotos] = useState<PhotoDraft[]>(
    () => product?.referenceImages.map((id) => ({ id })) ?? [],
  );

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  const otherSkus = products.filter((item) => item.id !== product?.id).map((item) => item.sku);
  const trimmedName = name.trim();
  const sku = skuInput === null ? suggestSku(trimmedName, otherSkus) : skuInput.trim().toUpperCase();
  const amount = parsePrice(price, currency);

  const errors = {
    name: trimmedName ? null : t.errors.name,
    sku: !SKU_PATTERN.test(sku) ? t.errors.sku : otherSkus.includes(sku) ? t.errors.skuTaken : null,
    price: amount === null ? t.errors.price(currency) : null,
    photos: photos.length > 0 ? null : t.errors.photos,
  };
  const visibleError = (error: string | null) => (submitted ? error : null);

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
        sku,
        name: trimmedName,
        price: amount,
        currency,
        // Not edited in this form; existing values are kept so nothing is lost.
        aliases: product?.aliases ?? [],
        visualHint: product?.visualHint,
        active: product?.active ?? true,
        referenceImages: photos.map((photo) => photo.id),
      });

      await deletePhotos(removedIds);
      router.push("/products");
    } catch {
      setSaveError(true);
      setSaving(false);
    }
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
            value={skuInput ?? sku}
            onChange={(event) => setSkuInput(event.target.value.toUpperCase())}
            maxLength={20}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t.skuPlaceholder}
            aria-invalid={Boolean(visibleError(errors.sku))}
            className={inputClass(Boolean(visibleError(errors.sku)))}
          />
        </Field>

        <Field id="product-price" label={t.price} error={visibleError(errors.price)} help={t.priceHelp(currency)}>
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

            {photos.length < MAX_PHOTOS &&
              (
                [
                  { key: "camera", label: t.takePhoto, Icon: Camera, capture: true },
                  { key: "gallery", label: t.choosePhoto, Icon: ImagePlus, capture: false },
                ] as const
              ).map(({ key, label, Icon, capture }) => (
                <li key={key} className="aspect-square">
                  <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-control border-2 border-dashed border-line text-primary has-focus-visible:outline-2 has-focus-visible:outline-primary">
                    <Icon aria-hidden size={20} />
                    <span className="px-1 text-center text-xs font-medium">{label}</span>
                    <input
                      type="file"
                      accept="image/*"
                      // capture opens the rear camera directly; without it the phone offers the gallery.
                      capture={capture ? "environment" : undefined}
                      multiple={!capture}
                      className="sr-only"
                      onChange={(event) => {
                        void addPhotos(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </li>
              ))}
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

        {/* Stays above the bottom nav while the form scrolls. */}
        <div className="form-actions sticky bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom))] -mx-4 border-t border-line bg-canvas px-4 py-3">
          <button
            type="submit"
            disabled={saving}
            className="h-12 w-full rounded-card bg-primary font-semibold text-white disabled:opacity-60"
          >
            {saving ? t.saving : t.save}
          </button>
        </div>
      </form>
    </>
  );
}
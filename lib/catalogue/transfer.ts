import { isCurrency, type Currency } from "@/lib/money";
import { loadPhoto, savePhoto } from "./photos";
import { isReservedSku } from "./sku";
import { productStore } from "./store";
import type { Product } from "./types";

export type CatalogueBundle = {
  version: 1;
  products: Product[];
  photos?: Record<string, string>;
};

export type ValidationResult =
  | { ok: true; bundle: CatalogueBundle }
  | { ok: false; reason: "invalid_file" | "currency_mismatch" };

const DATA_URL_PREFIX = "data:image/";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isValidProduct(value: unknown): value is Product {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    item.id.trim().length > 0 &&
    typeof item.sku === "string" &&
    item.sku.trim().length > 0 &&
    !isReservedSku(item.sku.trim()) &&
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    typeof item.price === "number" &&
    Number.isSafeInteger(item.price) &&
    item.price > 0 &&
    isCurrency(item.currency) &&
    isStringArray(item.aliases) &&
    isStringArray(item.referenceImages) &&
    (item.visualHint === undefined || typeof item.visualHint === "string") &&
    typeof item.active === "boolean"
  );
}

/**
 * Pure validation of a raw JSON string or parsed value before importing.
 * Rejects malformed files, duplicate SKUs, reserved SKUs, or currency mismatches
 * so a bad file never wipes or corrupts existing shop data.
 */
export function validateCatalogueJson(
  rawText: string,
  expectedCurrency?: Currency,
): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, reason: "invalid_file" };
  }

  const rawProducts = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as Record<string, unknown>).products)
      ? ((parsed as Record<string, unknown>).products as unknown[])
      : null;

  if (!rawProducts || rawProducts.length === 0) {
    return { ok: false, reason: "invalid_file" };
  }

  const seenSkus = new Set<string>();
  const seenIds = new Set<string>();
  const products: Product[] = [];

  for (const item of rawProducts) {
    if (!isValidProduct(item)) {
      return { ok: false, reason: "invalid_file" };
    }
    if (expectedCurrency && item.currency !== expectedCurrency) {
      return { ok: false, reason: "currency_mismatch" };
    }
    const normalizedSku = item.sku.trim().toUpperCase();
    const normalizedId = item.id.trim();
    if (seenSkus.has(normalizedSku) || seenIds.has(normalizedId)) {
      return { ok: false, reason: "invalid_file" };
    }
    seenSkus.add(normalizedSku);
    seenIds.add(normalizedId);

    products.push({
      id: normalizedId,
      sku: normalizedSku,
      name: item.name.trim(),
      price: item.price,
      currency: item.currency,
      aliases: item.aliases.map((a) => a.trim()).filter(Boolean),
      referenceImages: [...item.referenceImages],
      ...(item.visualHint?.trim() ? { visualHint: item.visualHint.trim() } : {}),
      active: item.active,
    });
  }

  let photos: Record<string, string> | undefined;
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    const rawPhotos = (parsed as Record<string, unknown>).photos;
    if (rawPhotos !== undefined) {
      if (typeof rawPhotos !== "object" || rawPhotos === null || Array.isArray(rawPhotos)) {
        return { ok: false, reason: "invalid_file" };
      }
      photos = {};
      for (const [id, dataUrl] of Object.entries(rawPhotos as Record<string, unknown>)) {
        if (typeof dataUrl !== "string" || !dataUrl.startsWith(DATA_URL_PREFIX)) {
          return { ok: false, reason: "invalid_file" };
        }
        photos[id] = dataUrl;
      }
    }
  }

  return {
    ok: true,
    bundle: { version: 1, products, ...(photos ? { photos } : {}) },
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Bad blob")));
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

export async function exportCatalogueBundle(products: Product[]): Promise<CatalogueBundle> {
  const photos: Record<string, string> = {};
  const photoIds = [...new Set(products.flatMap((product) => product.referenceImages))];

  for (const id of photoIds) {
    try {
      const blob = await loadPhoto(id);
      if (blob) {
        photos[id] = await blobToDataUrl(blob);
      }
    } catch {
      // Missing local blobs are skipped without failing the export.
    }
  }

  return {
    version: 1,
    products,
    ...(Object.keys(photos).length > 0 ? { photos } : {}),
  };
}

/**
 * Merges a validated bundle into the catalogue without deleting existing products.
 * Products with matching SKU or ID are updated; new products are appended.
 */
export async function applyCatalogueBundle(bundle: CatalogueBundle): Promise<number> {
  if (bundle.photos) {
    for (const [id, dataUrl] of Object.entries(bundle.photos)) {
      try {
        const blob = await dataUrlToBlob(dataUrl);
        await savePhoto(id, blob);
      } catch {
        // Continue importing product metadata even if one photo fails to decode.
      }
    }
  }

  const existing = productStore.get();
  const merged = [...existing];

  for (const incoming of bundle.products) {
    const index = merged.findIndex(
      (item) => item.id === incoming.id || item.sku.toUpperCase() === incoming.sku.toUpperCase(),
    );
    if (index >= 0) {
      merged[index] = { ...incoming, id: merged[index].id };
    } else {
      merged.push(incoming);
    }
  }

  productStore.set(merged);
  return bundle.products.length;
}

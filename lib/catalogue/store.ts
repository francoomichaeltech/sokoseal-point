import { isCurrency } from "@/lib/money";
import { createLocalStore, useLocalStore } from "@/lib/storage/local-store";
import { deletePhotos } from "./photos";
import type { Product } from "./types";

const EMPTY: Product[] = [];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isProduct(value: unknown): value is Product {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.sku === "string" &&
    typeof item.name === "string" &&
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

function parseProducts(raw: string | null): Product[] {
  if (!raw) return EMPTY;

  try {
    const value = JSON.parse(raw);
    // Invalid entries are dropped instead of discarding the whole catalogue.
    return Array.isArray(value) ? value.filter(isProduct) : EMPTY;
  } catch {
    return EMPTY;
  }
}

export const productStore = createLocalStore<Product[]>("sokoseal.products", parseProducts);

export function useProducts() {
  return useLocalStore(productStore);
}

export function upsertProduct(product: Product) {
  const products = productStore.get();
  const exists = products.some((item) => item.id === product.id);

  productStore.set(
    exists
      ? products.map((item) => (item.id === product.id ? product : item))
      : [...products, product],
  );
}

export async function removeProduct(id: string) {
  const product = productStore.get().find((item) => item.id === id);
  if (!product) return;

  productStore.set(productStore.get().filter((item) => item.id !== id));
  await deletePhotos(product.referenceImages);
}
import type { Product } from "@/lib/catalogue/types";

const MAX_KEYWORDS = 50;
const MAX_KEYWORD_LENGTH = 40;

// Shop words Muse Voice tends to mishear (for example "naomba" as "namba").
const SHOP_WORDS = [
  "naomba", "nipe", "nataka", "ongeza", "ondoa", "punguza", "hii", "hizi", "ile", "zile",
  "moja", "mbili", "tatu", "nne", "tano", "sita", "saba", "nane", "tisa", "kumi", "ishirini",
];

// Names and aliases of active products, used as recognition hints and as the shop's product list.
export function catalogueKeywords(products: Product[]): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const product of products) {
    if (!product.active) continue;

    for (const term of [product.name, ...product.aliases]) {
      const value = term.trim();
      const key = value.toLowerCase();
      if (!value || value.length > MAX_KEYWORD_LENGTH || seen.has(key)) continue;
      seen.add(key);
      keywords.push(value);
    }
  }

  return keywords.slice(0, MAX_KEYWORDS);
}

/** Hints for speech recognition: shop words first, then product names. Biases recognition; does not restrict it. */
export function voiceKeywords(products: Product[]): string[] {
  const seen = new Set<string>();
  return [...SHOP_WORDS, ...catalogueKeywords(products)]
    .filter((word) => {
      const key = word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_KEYWORDS);
}
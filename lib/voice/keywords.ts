import type { Product } from "@/lib/catalogue/types";

export const MAX_KEYWORDS = 50;
export const MAX_KEYWORD_LENGTH = 40;

// Shop words Muse Voice tends to mishear (for example "naomba" as "namba").
const SHOP_WORDS = [
  "naomba", "nipe", "nataka", "ongeza", "ondoa", "punguza", "hii", "hizi", "ile", "zile",
  "moja", "mbili", "tatu", "nne", "tano", "sita", "saba", "nane", "tisa", "kumi", "ishirini",
];

function appendUnique(target: string[], seen: Set<string>, raw: string) {
  const value = raw.trim();
  const key = value.toLowerCase();
  if (!value || value.length > MAX_KEYWORD_LENGTH || seen.has(key)) return;
  seen.add(key);
  target.push(value);
}

// Names and aliases of active products, with primary product names first, capped to route limits.
export function catalogueKeywords(products: Product[]): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];
  const active = products.filter((product) => product.active);

  for (const product of active) {
    appendUnique(keywords, seen, product.name);
  }
  for (const product of active) {
    for (const alias of product.aliases) {
      appendUnique(keywords, seen, alias);
    }
  }

  return keywords.slice(0, MAX_KEYWORDS);
}

/** Hints for speech recognition: shop product names first, then shop words, capped at the transcribe route limit. */
export function voiceKeywords(products: Product[]): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const word of [...catalogueKeywords(products), ...SHOP_WORDS]) {
    appendUnique(keywords, seen, word);
    if (keywords.length >= MAX_KEYWORDS) break;
  }

  return keywords;
}
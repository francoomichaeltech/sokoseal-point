import type { Product } from "@/lib/catalogue/types";

const MAX_KEYWORDS = 50;
const MAX_KEYWORD_LENGTH = 40;

// Names and aliases of active products, used as recognition hints, not as an allow-list.
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
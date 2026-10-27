import type { Currency } from "@/lib/money";

export type Product = {
  id: string;
  sku: string;
  name: string;
  /** Minor units, see lib/money.ts. */
  price: number;
  currency: Currency;
  aliases: string[];
  /** Photo IDs stored in IndexedDB. */
  referenceImages: string[];
  visualHint?: string;
  active: boolean;
};
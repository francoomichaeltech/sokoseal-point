import { isCurrency, type Currency } from "@/lib/money";
import { createLocalStore, useLocalStore } from "@/lib/storage/local-store";

export type Shop = {
  name: string;
  currency: Currency;
};

function parseShop(raw: string | null): Shop | null {
  if (!raw) return null;

  try {
    const value = JSON.parse(raw);
    if (typeof value?.name === "string" && value.name.trim() && isCurrency(value.currency)) {
      return { name: value.name, currency: value.currency };
    }
  } catch {
    // Corrupt data is treated as no shop, which sends the user back to setup.
  }
  return null;
}

export const shopStore = createLocalStore<Shop | null>("sokoseal.shop", parseShop);

// undefined: not read yet, null: setup not done.
export function useShop() {
  return useLocalStore(shopStore);
}
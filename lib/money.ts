export const CURRENCIES = ["USD", "TZS"] as const;

export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.includes(value as Currency);
}
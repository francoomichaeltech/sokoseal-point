export const SKU_MAX_LENGTH = 30;

// Identity uses these words for "no match"; a SKU equal to one would be ambiguous.
const RESERVED = new Set(["unknown", "ambiguous"]);

export type SkuProblem = "empty" | "reserved" | "taken";

// Merchants may use any code. Only spacing is normalized; case is kept as typed.
export function normalizeSku(input: string): string {
  return input.trim().replace(/\s+/g, " ").slice(0, SKU_MAX_LENGTH);
}

export function isReservedSku(sku: string): boolean {
  return RESERVED.has(sku.toLowerCase());
}

export function checkSku(sku: string, otherSkus: string[]): SkuProblem | null {
  if (!sku) return "empty";
  if (isReservedSku(sku)) return "reserved";
  const wanted = sku.toLowerCase();
  return otherSkus.some((other) => other.toLowerCase() === wanted) ? "taken" : null;
}
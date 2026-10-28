// Lower case, so they can never collide with a SKU (SKUs are upper case).
export const UNKNOWN = "unknown";
export const AMBIGUOUS = "ambiguous";

export type ReferenceProduct = { sku: string; name: string; image: string };

export type IdentityResult =
  /** One entry per target, in order: a SKU from the request, UNKNOWN or AMBIGUOUS. */
  | { status: "OK"; matches: string[]; latencyMs: number }
  | { status: "ERROR"; latencyMs: number };

/** What a pointed object is, as shown on Point. */
export type TargetIdentity =
  | { state: "pending" }
  | { state: "product"; sku: string; name: string }
  | { state: "unknown" }
  | { state: "ambiguous" }
  | { state: "error" };

export function targetKey(index: number): string {
  return `T${index + 1}`;
}
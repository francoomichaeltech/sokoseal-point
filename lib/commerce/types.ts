import type { ActionKind } from "@/lib/intent/types";
import type { Currency } from "@/lib/money";

export type BasketLine = {
  sku: string;
  name: string;
  /** Minor units, copied from the catalogue when the line last changed. */
  unitPrice: number;
  currency: Currency;
  quantity: number;
};

export type Basket = { lines: BasketLine[]; appliedEvents: string[] };

/** What one finger pause pointed at, after grounding and identity. */
export type PointedTarget =
  | { state: "product"; sku: string }
  | { state: "unknown" }
  | { state: "ambiguous" }
  | { state: "none" }
  | { state: "error" };

export type RejectReason =
  | "count_mismatch"
  | "nothing_pointed"
  | "not_in_shop"
  | "unclear_product"
  | "check_failed"
  | "no_previous"
  | "unclear_quantity"
  | "not_in_basket"
  | "not_enough"
  | "too_many";

export type Outcome = {
  action: ActionKind;
  quantity: number | null;
  spoken: string;
  /** 1-based pause the action was paired with, to match the numbered outline on screen. */
  pointNumber: number | null;
} & (
  | { status: "applied"; sku: string; name: string; lineQuantity: number }
  | { status: "rejected"; reason: RejectReason }
);
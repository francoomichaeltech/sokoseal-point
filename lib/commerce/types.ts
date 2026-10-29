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

/** What one pointing pointed at, after grounding and identity. */
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
  /** Position of the action in the spoken request. */
  index: number;
  action: ActionKind;
  quantity: number | null;
  spoken: string;
  /** 1-based pointing the action was paired with. */
  pointNumber: number | null;
} & (
  | { status: "applied"; sku: string; name: string; lineQuantity: number }
  | { status: "rejected"; reason: RejectReason }
);

/** Basket history: each request as it was applied, and each manual change after it. */
export type ProofEntry =
  | { kind: "request"; at: number; heard: string; transcript: string; outcomes: Outcome[] }
  | { kind: "edit"; at: number; name: string; from: number; to: number };

export type Basket = {
  lines: BasketLine[];
  appliedEvents: string[];
  proof: ProofEntry[];
  /** Set when the basket is sealed; a sealed basket cannot change. */
  sealedAt: number | null;
};
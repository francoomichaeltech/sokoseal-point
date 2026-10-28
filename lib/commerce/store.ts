import type { Product } from "@/lib/catalogue/types";
import type { IntentAction } from "@/lib/intent/types";
import { isCurrency } from "@/lib/money";
import { createLocalStore, useLocalStore } from "@/lib/storage/local-store";
import { applyActions, MAX_LINE_QUANTITY } from "./plan";
import type { Basket, BasketLine, Outcome, PointedTarget } from "./types";

const MAX_EVENTS = 50;
const EMPTY: Basket = { lines: [], appliedEvents: [] };

function isLine(value: unknown): value is BasketLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;

  return (
    typeof line.sku === "string" &&
    typeof line.name === "string" &&
    typeof line.unitPrice === "number" &&
    Number.isSafeInteger(line.unitPrice) &&
    line.unitPrice > 0 &&
    isCurrency(line.currency) &&
    typeof line.quantity === "number" &&
    Number.isInteger(line.quantity) &&
    line.quantity > 0 &&
    line.quantity <= MAX_LINE_QUANTITY
  );
}

function parseBasket(raw: string | null): Basket {
  if (!raw) return EMPTY;

  try {
    const value = JSON.parse(raw);
    return {
      lines: Array.isArray(value?.lines) ? value.lines.filter(isLine) : [],
      appliedEvents: Array.isArray(value?.appliedEvents)
        ? value.appliedEvents.filter((id: unknown): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return EMPTY;
  }
}

export const basketStore = createLocalStore<Basket>("sokoseal.basket", parseBasket);

export function useBasket() {
  return useLocalStore(basketStore);
}

// Returns null when this hold was already applied, so a repeated release cannot change the basket twice.
export function applyHold(
  eventId: string,
  actions: IntentAction[],
  targets: PointedTarget[],
  products: Product[],
): Outcome[] | null {
  const basket = basketStore.get();
  if (basket.appliedEvents.includes(eventId)) return null;

  const { lines, outcomes } = applyActions(basket.lines, actions, targets, products);
  basketStore.set({ lines, appliedEvents: [...basket.appliedEvents, eventId].slice(-MAX_EVENTS) });
  return outcomes;
}

export function setLineQuantity(sku: string, quantity: number) {
  const basket = basketStore.get();
  const clamped = Math.min(MAX_LINE_QUANTITY, Math.max(0, Math.round(quantity)));
  const lines =
    clamped === 0
      ? basket.lines.filter((line) => line.sku !== sku)
      : basket.lines.map((line) => (line.sku === sku ? { ...line, quantity: clamped } : line));

  basketStore.set({ ...basket, lines });
}

export function clearBasket() {
  basketStore.set({ ...basketStore.get(), lines: [] });
}
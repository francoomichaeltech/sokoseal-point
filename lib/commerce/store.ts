import type { Product } from "@/lib/catalogue/types";
import type { IntentAction } from "@/lib/intent/types";
import { isCurrency } from "@/lib/money";
import { createLocalStore, useLocalStore } from "@/lib/storage/local-store";
import { applyActions, MAX_LINE_QUANTITY, type Choice } from "./plan";
import type { Basket, BasketLine, Outcome, PointedTarget, ProofEntry } from "./types";

const MAX_EVENTS = 50;
const MAX_PROOF = 200;
const EMPTY: Basket = { lines: [], appliedEvents: [], proof: [], sealedAt: null };

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

function isProof(value: unknown): value is ProofEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.at !== "number") return false;

  if (entry.kind === "request") {
    return typeof entry.heard === "string" && typeof entry.transcript === "string" && Array.isArray(entry.outcomes);
  }
  return (
    entry.kind === "edit" &&
    typeof entry.name === "string" &&
    typeof entry.from === "number" &&
    typeof entry.to === "number"
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
      proof: Array.isArray(value?.proof) ? value.proof.filter(isProof) : [],
      sealedAt: typeof value?.sealedAt === "number" ? value.sealedAt : null,
    };
  } catch {
    return EMPTY;
  }
}

export const basketStore = createLocalStore<Basket>("sokoseal.basket", parseBasket);

export function useBasket() {
  return useLocalStore(basketStore);
}

export type HoldRecord = {
  eventId: string;
  heard: string;
  transcript: string;
  actions: IntentAction[];
  targets: PointedTarget[];
};

// Returns null when the basket is sealed or this hold was already applied, so a repeated tap cannot change it twice.
export function applyHold(hold: HoldRecord, products: Product[], chosen: Choice[] = []): Outcome[] | null {
  const basket = basketStore.get();
  if (basket.sealedAt !== null || basket.appliedEvents.includes(hold.eventId)) return null;

  const { lines, outcomes } = applyActions(basket.lines, hold.actions, hold.targets, products, chosen);
  const entry: ProofEntry = { kind: "request", at: Date.now(), heard: hold.heard, transcript: hold.transcript, outcomes };

  basketStore.set({
    ...basket,
    lines,
    appliedEvents: [...basket.appliedEvents, hold.eventId].slice(-MAX_EVENTS),
    proof: [...basket.proof, entry].slice(-MAX_PROOF),
  });
  return outcomes;
}

// Every manual change is recorded, so the proof shows what the user corrected.
export function setLineQuantity(sku: string, quantity: number) {
  const basket = basketStore.get();
  const line = basket.lines.find((item) => item.sku === sku);
  if (basket.sealedAt !== null || !line) return;

  const to = Math.min(MAX_LINE_QUANTITY, Math.max(0, Math.round(quantity)));
  if (to === line.quantity) return;

  const lines =
    to === 0
      ? basket.lines.filter((item) => item.sku !== sku)
      : basket.lines.map((item) => (item.sku === sku ? { ...item, quantity: to } : item));
  const entry: ProofEntry = { kind: "edit", at: Date.now(), name: line.name, from: line.quantity, to };

  basketStore.set({ ...basket, lines, proof: [...basket.proof, entry].slice(-MAX_PROOF) });
}

export function sealBasket() {
  const basket = basketStore.get();
  if (basket.sealedAt === null && basket.lines.length > 0) basketStore.set({ ...basket, sealedAt: Date.now() });
}

// Clears the sealed basket. Applied event ids are kept so an old hold can never be applied again.
export function startNewBasket() {
  basketStore.set({ ...EMPTY, appliedEvents: basketStore.get().appliedEvents });
}

/**
 * Removes a line after the user confirmed it. Removing the last line clears the basket and its proof,
 * since nothing is left to review. Returns true when the basket is now empty.
 */
export function removeLine(sku: string): boolean {
  const basket = basketStore.get();

  if (basket.sealedAt !== null || !basket.lines.some((line) => line.sku === sku)) return false;

  if (basket.lines.length === 1) {
    basketStore.set({ ...EMPTY, appliedEvents: basket.appliedEvents });
    return true;
  }

  setLineQuantity(sku, 0);
  return false;
}
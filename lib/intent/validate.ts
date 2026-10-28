import type { ActionKind, Intent, IntentAction, Reference } from "./types";

export const MAX_ACTIONS = 10;
const MAX_QUANTITY = 999;
const MAX_TEXT_LENGTH = 200;
const MAX_TRANSCRIPT_LENGTH = 800;

const ACTIONS: readonly ActionKind[] = ["ADD", "REMOVE", "SET"];
const REFERENCES: readonly Reference[] = ["POINT", "SAME", "NAMED"];

function isAction(value: unknown): value is ActionKind {
  return ACTIONS.includes(value as ActionKind);
}

function isReference(value: unknown): value is Reference {
  return REFERENCES.includes(value as Reference);
}

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_TEXT_LENGTH) : null;
}

function cleanQuantity(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= MAX_QUANTITY
    ? value
    : null;
}

// Model output is untrusted. A shape error rejects the whole result instead of guessing which part is right.
export function parseIntent(raw: unknown): Intent | null {
  if (typeof raw !== "object" || raw === null) return null;

  const { transcript, actions, needs_clarification } = raw as Record<string, unknown>;
  if (
    typeof transcript !== "string" ||
    !Array.isArray(actions) ||
    actions.length > MAX_ACTIONS ||
    typeof needs_clarification !== "boolean"
  ) {
    return null;
  }

  let needsClarification = needs_clarification;
  const parsed: IntentAction[] = [];

  for (const item of actions) {
    if (typeof item !== "object" || item === null) return null;

    const { action, quantity, reference, named_product, spoken } = item as Record<string, unknown>;
    if (!isAction(action) || !isReference(reference)) return null;

    const namedProduct = cleanText(named_product);
    if (reference === "NAMED" && !namedProduct) return null;

    const cleanedQuantity = cleanQuantity(quantity);
    // Zero, negative, fractional or absurd amounts are cleared so the action cannot be applied as said.
    if (quantity !== null && cleanedQuantity === null) needsClarification = true;

    parsed.push({
      action,
      quantity: cleanedQuantity,
      reference,
      namedProduct,
      spoken: cleanText(spoken) ?? "",
    });
  }

  return { transcript: transcript.trim().slice(0, MAX_TRANSCRIPT_LENGTH), actions: parsed, needsClarification };
}
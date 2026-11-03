import type { ActionKind, Intent, IntentAction, Reference } from "./types";

export const MAX_ACTIONS = 20;
const MAX_QUANTITY = 999;
const MAX_TEXT_LENGTH = 200;
const MAX_TRANSCRIPT_LENGTH = 3_000;

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

function normalizeSpoken(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function countOccurrences(haystack: string, needle: string): number {
  if (!haystack || !needle) return 0;
  let count = 0;
  let pos = 0;
  while (pos <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) break;
    count++;
    pos = idx + needle.length;
  }
  return count;
}

function isSameActionSignature(a: IntentAction, b: IntentAction): boolean {
  return (
    a.action === b.action &&
    a.quantity !== null &&
    a.quantity === b.quantity &&
    a.reference === b.reference &&
    (a.namedProduct ?? "").toLowerCase() === (b.namedProduct ?? "").toLowerCase() &&
    Boolean(normalizeSpoken(a.spoken)) &&
    normalizeSpoken(a.spoken) === normalizeSpoken(b.spoken)
  );
}

/**
 * Drops adjacent duplicate actions only when they come from the same spoken words in the transcript,
 * while keeping genuine repeats such as "hii moja, na hii moja".
 */
export function deduplicateActions(actions: IntentAction[], transcript: string): IntentAction[] {
  const normTranscript = normalizeSpoken(transcript);
  const result: IntentAction[] = [];

  for (const action of actions) {
    const prev = result[result.length - 1];
    if (prev && isSameActionSignature(prev, action)) {
      const normSpoken = normalizeSpoken(action.spoken);
      const inTranscript = countOccurrences(normTranscript, normSpoken);
      const allowedRepeats = Math.max(1, inTranscript);
      let streak = 0;
      for (let i = result.length - 1; i >= 0; i--) {
        if (isSameActionSignature(result[i], action)) streak++;
        else break;
      }
      if (streak >= allowedRepeats) {
        continue;
      }
    }
    result.push(action);
  }

  return result;
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

  const cleanTranscript = transcript.trim().slice(0, MAX_TRANSCRIPT_LENGTH);
  return {
    transcript: cleanTranscript,
    actions: deduplicateActions(parsed, cleanTranscript),
    needsClarification,
  };
}
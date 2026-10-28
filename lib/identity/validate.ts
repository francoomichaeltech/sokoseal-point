import { AMBIGUOUS, targetKey, UNKNOWN } from "./types";

// Model output is untrusted: any missing or unexpected value rejects the whole result.
export function parseIdentity(raw: unknown, skus: string[], count: number): string[] | null {
  if (typeof raw !== "object" || raw === null) return null;

  const allowed = new Set([...skus, UNKNOWN, AMBIGUOUS]);
  const matches: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const value = (raw as Record<string, unknown>)[targetKey(index)];
    if (typeof value !== "string" || !allowed.has(value)) return null;
    matches.push(value);
  }

  return matches;
}
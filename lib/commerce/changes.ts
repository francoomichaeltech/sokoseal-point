export type Change = { kind: "added" | "reduced"; amount: number } | { kind: "removed" };

/** What a manual quantity change did, for the proof. */
export function describeChange(from: number, to: number): Change {
  if (to === 0) return { kind: "removed" };
  return to > from ? { kind: "added", amount: to - from } : { kind: "reduced", amount: from - to };
}
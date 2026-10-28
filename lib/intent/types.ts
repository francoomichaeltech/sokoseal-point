export type ActionKind = "ADD" | "REMOVE" | "SET";

/** POINT: this/that, resolved from the finger. SAME: the previous action's product. NAMED: said by name. */
export type Reference = "POINT" | "SAME" | "NAMED";

export type IntentAction = {
  action: ActionKind;
  /** null means unclear for ADD and SET, and the whole line for REMOVE. */
  quantity: number | null;
  reference: Reference;
  namedProduct: string | null;
  spoken: string;
};

export type Intent = {
  /** What the speaker meant, with obvious mishearings fixed. Numbers and requests are kept as spoken. */
  transcript: string;
  actions: IntentAction[];
  needsClarification: boolean;
};

export type IntentResult =
  | { status: "OK"; intent: Intent; latencyMs: number }
  | { status: "ERROR"; latencyMs: number };
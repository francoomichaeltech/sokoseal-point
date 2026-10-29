import { describe, expect, it } from "vitest";
import type { Product } from "../lib/catalogue/types";
import { applyActions } from "../lib/commerce/plan";
import type { BasketLine, Outcome, PointedTarget } from "../lib/commerce/types";
import type { ActionKind, IntentAction, Reference } from "../lib/intent/types";

function product(sku: string, name: string, price: number, aliases: string[], active = true): Product {
  return { id: sku, sku, name, price, currency: "USD", aliases, referenceImages: [], active };
}

const products = [
  product("MUG1", "Mug", 500, ["kikombe"]),
  product("PEN1", "Pen", 200, ["kalamu"]),
  product("STR1", "Strainer", 300, ["chujio"], false),
];

function act(action: ActionKind, quantity: number | null, reference: Reference, namedProduct: string | null = null): IntentAction {
  return { action, quantity, reference, namedProduct, spoken: `${action} ${quantity ?? ""}` };
}

function line(sku: string, quantity: number): BasketLine {
  return { sku, name: sku, unitPrice: 1, currency: "USD", quantity };
}

const mug: PointedTarget = { state: "product", sku: "MUG1" };
const pen: PointedTarget = { state: "product", sku: "PEN1" };

const summary = (lines: BasketLine[]) => lines.map((item) => `${item.sku} ${item.quantity}`);
const reasons = (outcomes: Outcome[]) =>
  outcomes.map((outcome) => (outcome.status === "applied" ? "applied" : outcome.reason));

describe("applyActions", () => {
  it("applies the long Kiswahili request in order and rejects the unsafe parts", () => {
    // "nipe hii mbili, na hii moja, ondoa moja kwa hii kisha ongeza tano, nipe hii tano, na hii moja"
    const { lines, outcomes } = applyActions(
      [],
      [
        act("ADD", 2, "POINT"),
        act("ADD", 1, "POINT"),
        act("REMOVE", 1, "POINT"),
        act("ADD", 5, "SAME"),
        act("ADD", 5, "POINT"),
        act("ADD", 1, "POINT"),
      ],
      [mug, pen, mug, { state: "none" }, { state: "unknown" }],
      products,
    );

    expect(summary(lines)).toEqual(["MUG1 6", "PEN1 1"]);
    expect(reasons(outcomes)).toEqual(["applied", "applied", "applied", "applied", "nothing_pointed", "not_in_shop"]);
    expect(lines[0].unitPrice).toBe(500);
  });

  it("applies no pointed request when pauses and this/that do not match", () => {
    const { lines, outcomes } = applyActions([], [act("ADD", 2, "POINT"), act("ADD", 1, "POINT")], [mug], products);
    expect(lines).toEqual([]);
    expect(reasons(outcomes)).toEqual(["count_mismatch", "count_mismatch"]);
  });

  it("does not follow on from a rejected request", () => {
    const { outcomes } = applyActions([], [act("ADD", 1, "POINT"), act("ADD", 5, "SAME")], [{ state: "unknown" }], products);
    expect(reasons(outcomes)).toEqual(["not_in_shop", "no_previous"]);
  });

  it("matches a named product by name or alias only", () => {
    const named = applyActions([], [act("ADD", 2, "NAMED", "Kikombe")], [], products);
    expect(summary(named.lines)).toEqual(["MUG1 2"]);

    const missing = applyActions([], [act("ADD", 1, "NAMED", "sabuni")], [], products);
    expect(reasons(missing.outcomes)).toEqual(["not_in_shop"]);
  });

  it("never removes more than the basket holds", () => {
    const start = [line("MUG1", 2)];
    expect(reasons(applyActions(start, [act("REMOVE", 5, "NAMED", "mug")], [], products).outcomes)).toEqual(["not_enough"]);
    expect(reasons(applyActions(start, [act("REMOVE", null, "NAMED", "kalamu")], [], products).outcomes)).toEqual([
      "not_in_basket",
    ]);
    expect(applyActions(start, [act("REMOVE", null, "NAMED", "mug")], [], products).lines).toEqual([]);
  });

  it("sets an absolute quantity", () => {
    const { lines } = applyActions([line("MUG1", 2)], [act("SET", 7, "NAMED", "mug")], [], products);
    expect(summary(lines)).toEqual(["MUG1 7"]);
  });

  it("rejects an inactive product even if it was identified", () => {
    const { outcomes } = applyActions([], [act("ADD", 1, "POINT")], [{ state: "product", sku: "STR1" }], products);
    expect(reasons(outcomes)).toEqual(["not_in_shop"]);
  });

  it("rejects an unclear quantity and a line above the limit", () => {
    expect(reasons(applyActions([], [act("ADD", null, "POINT")], [mug], products).outcomes)).toEqual(["unclear_quantity"]);
    expect(reasons(applyActions([line("MUG1", 1)], [act("ADD", 999, "POINT")], [mug], products).outcomes)).toEqual([
      "too_many",
    ]);
  });

  it("does not change the lines it was given", () => {
    const start = [line("MUG1", 2)];
    applyActions(start, [act("ADD", 3, "POINT")], [mug], products);
    expect(start).toEqual([line("MUG1", 2)]);
  });
});

describe("choices", () => {
  it("uses a product the user picked and drops a skipped request", () => {
    const { lines, outcomes } = applyActions(
      [],
      [act("ADD", 2, "POINT"), act("ADD", 1, "POINT")],
      [mug],
      products,
      ["PEN1", null],
    );

    expect(summary(lines)).toEqual(["PEN1 2"]);
    expect(outcomes).toHaveLength(1);
  });
});
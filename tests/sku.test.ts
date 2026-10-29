import { describe, expect, it } from "vitest";
import { checkSku, normalizeSku } from "../lib/catalogue/sku";

describe("normalizeSku", () => {
  it("keeps the merchant's code and case, tidying spaces", () => {
    expect(normalizeSku("  Coke  500ml ")).toBe("Coke 500ml");
  });

  it("limits the length", () => {
    expect(normalizeSku("x".repeat(40))).toHaveLength(30);
  });
});

describe("checkSku", () => {
  it("accepts any non-empty unused code", () => {
    expect(checkSku("chumvi-1kg", ["MUG1"])).toBeNull();
  });

  it("rejects an empty code", () => {
    expect(checkSku("", [])).toBe("empty");
  });

  it("rejects a code used by another product, ignoring case", () => {
    expect(checkSku("mug1", ["MUG1"])).toBe("taken");
  });

  it("rejects the words identity uses for no match", () => {
    expect(checkSku("Unknown", [])).toBe("reserved");
    expect(checkSku("AMBIGUOUS", [])).toBe("reserved");
  });
});
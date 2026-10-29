import { describe, expect, it } from "vitest";
import { suggestSku } from "../lib/catalogue/sku";

describe("suggestSku", () => {
  it("uses the first letters of the name", () => {
    expect(suggestSku("Mug", [])).toBe("MUG1");
    expect(suggestSku("Coca-Cola 500ml", [])).toBe("COC1");
  });

  it("takes the next free number", () => {
    expect(suggestSku("Mug", ["MUG1", "MUG2"])).toBe("MUG3");
  });

  it("drops accents and symbols", () => {
    expect(suggestSku("Pé", [])).toBe("PE1");
  });

  it("falls back when the name has no letters or digits", () => {
    expect(suggestSku("", [])).toBe("ITEM1");
    expect(suggestSku("★", ["ITEM1"])).toBe("ITEM2");
  });
});
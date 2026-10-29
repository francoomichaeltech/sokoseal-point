import { describe, expect, it } from "vitest";
import { generateSku } from "../lib/catalogue/sku";

describe("generateSku", () => {
  it("uses the first three letters of the name", () => {
    expect(generateSku("Pepsi", [])).toBe("PEP1");
    expect(generateSku("Coca-Cola 500ml", [])).toBe("COC1");
  });

  it("takes the next free number, ignoring case", () => {
    expect(generateSku("Pepsi", ["PEP1", "pep2"])).toBe("PEP3");
  });

  it("falls back when the name has no letters or digits", () => {
    expect(generateSku("★", [])).toBe("ITEM1");
  });
});
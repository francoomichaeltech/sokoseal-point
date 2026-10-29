import { describe, expect, it } from "vitest";
import type { Product } from "../lib/catalogue/types";
import { catalogueKeywords, voiceKeywords } from "../lib/voice/keywords";

function product(overrides: Partial<Product>): Product {
  return {
    id: "p",
    sku: "SKU",
    name: "Name",
    price: 100,
    currency: "TZS",
    aliases: [],
    referenceImages: [],
    active: true,
    ...overrides,
  };
}

describe("catalogueKeywords", () => {
  it("uses names and aliases of active products without duplicates", () => {
    expect(
      catalogueKeywords([
        product({ name: "Mug", aliases: ["kikombe", "cup", "mug"] }),
        product({ name: "Pen", aliases: ["kalamu"], active: false }),
      ]),
    ).toEqual(["Mug", "kikombe", "cup"]);
  });

  it("skips blank and overlong terms", () => {
    expect(catalogueKeywords([product({ name: "Pen", aliases: ["  ", "x".repeat(41)] })])).toEqual(["Pen"]);
  });
});

describe("voiceKeywords", () => {
  it("puts shop words first and adds product names without duplicates", () => {
    const words = voiceKeywords([product({ name: "Mug", aliases: ["naomba"] })]);

    expect(words[0]).toBe("naomba");
    expect(words).toContain("Mug");
    expect(words.filter((word) => word === "naomba")).toHaveLength(1);
  });
});
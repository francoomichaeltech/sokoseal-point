import { describe, expect, it } from "vitest";
import type { Product } from "../lib/catalogue/types";
import { catalogueKeywords } from "../lib/voice/keywords";

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
import { describe, expect, it } from "vitest";
import type { Product } from "../lib/catalogue/types";
import { catalogueKeywords, MAX_KEYWORD_LENGTH, MAX_KEYWORDS, voiceKeywords } from "../lib/voice/keywords";

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
  it("puts shop product names first and adds shop words without duplicates", () => {
    const words = voiceKeywords([
      product({ name: "Mug", aliases: ["kikombe", "naomba"] }),
      product({ id: "p2", sku: "PEN", name: "Pen", aliases: ["kalamu"] }),
    ]);

    expect(words.slice(0, 4)).toEqual(["Mug", "Pen", "kikombe", "naomba"]);
    expect(words).toContain("kalamu");
    expect(words.filter((word) => word.toLowerCase() === "naomba")).toHaveLength(1);
  });

  it("never exceeds the transcribe route keyword count or length limits", () => {
    const manyProducts = Array.from({ length: 60 }, (_, index) =>
      product({
        id: `p-${index}`,
        sku: `SKU${index}`,
        name: `Product ${index}`,
        aliases: [`Alias ${index}`, "x".repeat(MAX_KEYWORD_LENGTH + 5)],
      }),
    );
    const words = voiceKeywords(manyProducts);

    expect(words).toHaveLength(MAX_KEYWORDS);
    expect(words[0]).toBe("Product 0");
    expect(words[MAX_KEYWORDS - 1]).toBe(`Product ${MAX_KEYWORDS - 1}`);
    expect(words.every((w) => w.length <= MAX_KEYWORD_LENGTH)).toBe(true);
  });
});
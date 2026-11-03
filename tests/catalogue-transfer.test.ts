import { describe, expect, it } from "vitest";
import { validateCatalogueJson } from "../lib/catalogue/transfer";

const validProduct = {
  id: "prod-1",
  sku: "CHU1",
  name: "Chumvi",
  price: 1000,
  currency: "TZS",
  aliases: ["salt"],
  referenceImages: ["photo-1"],
  active: true,
};

describe("validateCatalogueJson", () => {
  it("accepts a valid catalogue bundle with products and photos", () => {
    const raw = JSON.stringify({
      version: 1,
      products: [validProduct],
      photos: { "photo-1": "data:image/jpeg;base64,/9j/4AAQ" },
    });
    const result = validateCatalogueJson(raw, "TZS");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bundle.products).toHaveLength(1);
      expect(result.bundle.products[0].sku).toBe("CHU1");
    }
  });

  it("rejects malformed JSON, empty lists, reserved SKUs, duplicate SKUs and invalid photos", () => {
    expect(validateCatalogueJson("not json", "TZS")).toEqual({ ok: false, reason: "invalid_file" });
    expect(validateCatalogueJson(JSON.stringify({ products: [] }), "TZS")).toEqual({
      ok: false,
      reason: "invalid_file",
    });
    expect(
      validateCatalogueJson(
        JSON.stringify({ products: [{ ...validProduct, sku: "UNKNOWN" }] }),
        "TZS",
      ),
    ).toEqual({ ok: false, reason: "invalid_file" });
    expect(
      validateCatalogueJson(
        JSON.stringify({
          products: [validProduct, { ...validProduct, id: "prod-2", sku: "chu1" }],
        }),
        "TZS",
      ),
    ).toEqual({ ok: false, reason: "invalid_file" });
    expect(
      validateCatalogueJson(
        JSON.stringify({
          products: [validProduct],
          photos: { "photo-1": "http://example.com/not-a-data-url.jpg" },
        }),
        "TZS",
      ),
    ).toEqual({ ok: false, reason: "invalid_file" });
  });

  it("rejects a catalogue whose currency does not match the shop currency", () => {
    const raw = JSON.stringify({ products: [{ ...validProduct, currency: "USD" }] });
    expect(validateCatalogueJson(raw, "TZS")).toEqual({ ok: false, reason: "currency_mismatch" });
  });
});

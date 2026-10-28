import { describe, expect, it } from "vitest";
import { identityContent, identitySchema } from "../lib/identity/prompt";
import { AMBIGUOUS, UNKNOWN } from "../lib/identity/types";
import { parseIdentity } from "../lib/identity/validate";

const skus = ["MUG1", "PEN1", "STR1"];

describe("identitySchema", () => {
  it("requires one answer per crop, limited to shop SKUs", () => {
    const schema = identitySchema(skus, 2);
    expect(schema.required).toEqual(["T1", "T2"]);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.T1.enum).toEqual(["MUG1", "PEN1", "STR1", UNKNOWN, AMBIGUOUS]);
  });
});

describe("identityContent", () => {
  it("puts references before crops and quotes product names", () => {
    const content = identityContent(["data:image/jpeg;base64,T"], [
      { sku: "MUG1", name: 'Mug "big"', image: "data:image/jpeg;base64,R" },
    ]);
    const texts = content.flatMap((part) => (part.type === "input_text" ? [part.text] : []));

    expect(texts).toContain('Reference MUG1 "Mug \\"big\\"":');
    expect(texts.indexOf('Reference MUG1 "Mug \\"big\\"":')).toBeLessThan(texts.indexOf("Crop T1:"));
  });
});

describe("parseIdentity", () => {
  it("returns one match per crop in order", () => {
    expect(parseIdentity({ T1: "MUG1", T2: UNKNOWN, T3: AMBIGUOUS }, skus, 3)).toEqual(["MUG1", UNKNOWN, AMBIGUOUS]);
  });

  it("rejects a SKU that is not in the shop", () => {
    expect(parseIdentity({ T1: "SOAP1" }, skus, 1)).toBeNull();
  });

  it("rejects a missing crop", () => {
    expect(parseIdentity({ T1: "MUG1" }, skus, 2)).toBeNull();
  });

  it("rejects output that is not an object", () => {
    expect(parseIdentity("MUG1", skus, 1)).toBeNull();
  });

  it("treats an upper-case UNKNOWN SKU as a product, not as no match", () => {
    expect(parseIdentity({ T1: "UNKNOWN" }, ["UNKNOWN"], 1)).toEqual(["UNKNOWN"]);
  });
});
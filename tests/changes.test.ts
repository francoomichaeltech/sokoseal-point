import { describe, expect, it } from "vitest";
import { describeChange } from "../lib/commerce/changes";

describe("describeChange", () => {
  it("reports an increase", () => {
    expect(describeChange(5, 6)).toEqual({ kind: "added", amount: 1 });
  });

  it("reports a decrease", () => {
    expect(describeChange(6, 4)).toEqual({ kind: "reduced", amount: 2 });
  });

  it("reports a removal", () => {
    expect(describeChange(4, 0)).toEqual({ kind: "removed" });
  });
});
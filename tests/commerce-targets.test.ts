import { describe, expect, it } from "vitest";
import { toPointedTargets } from "../lib/commerce/targets";

const box = { x1: 0, y1: 0, x2: 0.1, y2: 0.1 };

describe("toPointedTargets", () => {
  it("maps each finger pause to what it pointed at", () => {
    expect(
      toPointedTargets(
        [
          { status: "MATCH", box },
          { status: "MATCH", box },
          { status: "NONE" },
          { status: "AMBIGUOUS", boxes: [box, box] },
          { status: "MATCH", box },
        ],
        [{ state: "product", sku: "MUG1", name: "Mug" }, { state: "unknown" }, null, null, { state: "pending" }],
      ),
    ).toEqual([
      { state: "product", sku: "MUG1" },
      { state: "unknown" },
      { state: "none" },
      { state: "ambiguous" },
      { state: "error" },
    ]);
  });
});
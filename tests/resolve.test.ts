import { describe, expect, it } from "vitest";
import { nearestBox, resolveDwell } from "../lib/pointing/resolve";

const mug = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.4 };
const pen = { x1: 0.5, y1: 0.2, x2: 0.9, y2: 0.25 };
const hand = { x1: 0.15, y1: 0.6, x2: 0.35, y2: 0.95 };

describe("resolveDwell", () => {
  it("follows the finger to an object", () => {
    expect(resolveDwell([mug, pen], { tip: { x: 0.2, y: 0.6 }, direction: { x: 0, y: -1 }, hand })).toEqual({
      status: "MATCH",
      box: mug,
    });
  });

  it("uses the nearest object when the ray passes beside it", () => {
    expect(resolveDwell([mug, pen], { tip: { x: 0.34, y: 0.45 }, direction: { x: 0, y: -1 }, hand })).toEqual({
      status: "MATCH",
      box: mug,
    });
  });

  it("caps the finger ray relative to finger length so empty space does not hit a distant product", () => {
    expect(
      resolveDwell(
        [mug],
        {
          tip: { x: 0.2, y: 0.85 },
          direction: { x: 0, y: -1 },
          hand: { x1: 0.15, y1: 0.85, x2: 0.3, y2: 0.98 },
          fingerLength: 0.08,
        },
      ),
    ).toEqual({ status: "NONE" });
  });

  it("picks the product right next to the fingertip before following the ray to another product", () => {
    const nearProduct = { x1: 0.22, y1: 0.44, x2: 0.34, y2: 0.56 };
    const rayProduct = { x1: 0.15, y1: 0.25, x2: 0.25, y2: 0.35 };
    expect(
      resolveDwell([nearProduct, rayProduct], {
        tip: { x: 0.2, y: 0.45 },
        direction: { x: 0, y: -1 },
        hand,
      }),
    ).toEqual({ status: "MATCH", box: nearProduct });
  });

  it("marks equally close products at the fingertip as AMBIGUOUS instead of guessing along the ray", () => {
    const leftProduct = { x1: 0.1, y1: 0.3, x2: 0.28, y2: 0.45 };
    const rightProduct = { x1: 0.31, y1: 0.3, x2: 0.48, y2: 0.45 };
    expect(
      resolveDwell([leftProduct, rightProduct], {
        tip: { x: 0.295, y: 0.45 },
        direction: { x: -0.5, y: -0.86 },
        hand,
      }).status,
    ).toBe("AMBIGUOUS");
  });
});

describe("nearestBox", () => {
  it("is ambiguous between two equally close objects", () => {
    const left = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 };
    const right = { x1: 0.36, y1: 0.1, x2: 0.5, y2: 0.3 };
    expect(nearestBox([left, right], { x: 0.33, y: 0.2 }).status).toBe("AMBIGUOUS");
  });

  it("returns NONE when nothing is close", () => {
    expect(nearestBox([mug], { x: 0.8, y: 0.9 })).toEqual({ status: "NONE" });
  });
});
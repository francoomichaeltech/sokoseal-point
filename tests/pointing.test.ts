import { describe, expect, it } from "vitest";
import { selectAlongRay } from "../lib/grounding/select";
import { readPointer } from "../lib/pointing/gesture";

const mug = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.4 };
const pen = { x1: 0.6, y1: 0.1, x2: 0.9, y2: 0.2 };
const hand = { x1: 0.15, y1: 0.6, x2: 0.35, y2: 0.95 };

describe("selectAlongRay", () => {
  it("returns the first object in the pointing direction", () => {
    expect(selectAlongRay([mug, pen, hand], { x: 0.2, y: 0.6 }, { x: 0, y: -1 }, hand)).toEqual({
      status: "MATCH",
      box: mug,
    });
  });

  it("ignores objects behind the finger", () => {
    expect(selectAlongRay([mug, pen], { x: 0.4, y: 0.15 }, { x: 1, y: 0 })).toEqual({
      status: "MATCH",
      box: pen,
    });
  });

  it("returns NONE when the ray leaves the frame without a hit", () => {
    expect(selectAlongRay([mug, pen], { x: 0.5, y: 0.5 }, { x: 1, y: 0 })).toEqual({ status: "NONE" });
  });

  it("ignores a detection that is the hand itself", () => {
    const handDetection = { x1: 0.14, y1: 0.58, x2: 0.36, y2: 0.97 };
    expect(selectAlongRay([handDetection], { x: 0.25, y: 0.6 }, { x: 0, y: 1 }, hand)).toEqual({
      status: "NONE",
    });
  });

  it("returns NONE without a direction", () => {
    expect(selectAlongRay([mug], { x: 0.2, y: 0.6 }, { x: 0, y: 0 })).toEqual({ status: "NONE" });
  });
});

// Index finger pointing straight up, other fingers folded.
function pointingHand() {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8 }));
  landmarks[0] = { x: 0.5, y: 0.9 };
  landmarks[5] = { x: 0.5, y: 0.7 };
  landmarks[6] = { x: 0.5, y: 0.6 };
  landmarks[8] = { x: 0.5, y: 0.5 };
  landmarks[10] = { x: 0.55, y: 0.68 };
  landmarks[12] = { x: 0.55, y: 0.78 };
  landmarks[14] = { x: 0.6, y: 0.7 };
  landmarks[16] = { x: 0.58, y: 0.8 };
  landmarks[18] = { x: 0.63, y: 0.72 };
  landmarks[20] = { x: 0.6, y: 0.82 };
  return landmarks;
}

describe("readPointer", () => {
  it("reads the tip and direction of a pointing hand", () => {
    const pointer = readPointer(pointingHand());
    expect(pointer?.tip).toEqual({ x: 0.5, y: 0.5 });
    expect(pointer?.direction.x).toBeCloseTo(0);
    expect(pointer?.direction.y).toBeCloseTo(-1);
  });

  it("ignores an open hand", () => {
    const landmarks = pointingHand();
    landmarks[12] = { x: 0.55, y: 0.35 };
    landmarks[16] = { x: 0.6, y: 0.38 };
    expect(readPointer(landmarks)).toBeNull();
  });
});
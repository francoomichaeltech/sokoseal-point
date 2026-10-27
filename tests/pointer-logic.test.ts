import { describe, expect, it } from "vitest";
import { castRay, withoutHand } from "../lib/grounding/select";
import { OneEuroFilter } from "../lib/pointing/one-euro";
import { sceneDifference, THUMBNAIL_SIZE } from "../lib/pointing/scene";

const mug = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.4 };
const hand = { x1: 0.15, y1: 0.6, x2: 0.35, y2: 0.95 };

describe("castRay", () => {
  it("returns the object and where the ray reaches it", () => {
    const hit = castRay([mug], { x: 0.2, y: 0.6 }, { x: 0, y: -1 });
    expect(hit.selection).toEqual({ status: "MATCH", box: mug });
    expect(hit.at?.y).toBeLessThanOrEqual(mug.y2 + 0.01);
    expect(hit.at?.y).toBeGreaterThan(mug.y1);
  });

  it("returns no point when the ray hits nothing", () => {
    expect(castRay([mug], { x: 0.5, y: 0.5 }, { x: 1, y: 0 })).toEqual({
      selection: { status: "NONE" },
      at: null,
    });
  });
});

describe("withoutHand", () => {
  it("drops a detection that covers the tracked hand", () => {
    const handDetection = { x1: 0.14, y1: 0.58, x2: 0.36, y2: 0.97 };
    expect(withoutHand([mug, handDetection], hand)).toEqual([mug]);
  });

  it("keeps every box without a hand", () => {
    expect(withoutHand([mug])).toEqual([mug]);
  });
});

describe("OneEuroFilter", () => {
  it("passes the first value through", () => {
    expect(new OneEuroFilter(1.5, 4).filter(0.5, 0)).toBe(0.5);
  });

  it("damps small jitter while the hand is still", () => {
    const filter = new OneEuroFilter(1.5, 4);
    filter.filter(0.5, 0);
    expect(Math.abs(filter.filter(0.51, 33) - 0.5)).toBeLessThan(0.005);
  });

  it("follows a fast movement with little lag", () => {
    const filter = new OneEuroFilter(1.5, 4);
    let output = filter.filter(0, 0);
    for (let i = 1; i <= 10; i += 1) output = filter.filter(i * 0.05, i * 33);
    expect(output).toBeGreaterThan(0.4);
  });
});

describe("sceneDifference", () => {
  const size = THUMBNAIL_SIZE.width * THUMBNAIL_SIZE.height;

  it("is zero for identical frames", () => {
    const frame = new Uint8Array(size).fill(100);
    expect(sceneDifference(frame, frame.slice())).toBe(0);
  });

  it("measures a change across the frame", () => {
    expect(sceneDifference(new Uint8Array(size).fill(100), new Uint8Array(size).fill(140))).toBe(40);
  });

  it("ignores changes inside the hand box", () => {
    const before = new Uint8Array(size).fill(100);
    const after = before.slice();
    for (let row = 0; row < THUMBNAIL_SIZE.height; row += 1) {
      for (let col = 0; col < THUMBNAIL_SIZE.width / 2; col += 1) {
        after[row * THUMBNAIL_SIZE.width + col] = 255;
      }
    }
    expect(sceneDifference(before, after, [{ x1: 0, y1: 0, x2: 0.5, y2: 1 }])).toBe(0);
  });
});
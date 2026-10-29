import { describe, expect, it } from "vitest";
import { segmentVisits, type TraceSample } from "../lib/pointing/trace";

const mug = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.4 };
const pen = { x1: 0.6, y1: 0.1, x2: 0.9, y2: 0.2 };
const boxes = [mug, pen];

// The finger points up at the object above the tip; the hand sits below the tip.
function sample(x: number, y: number, at: number, up = true): TraceSample {
  return {
    tip: { x, y },
    direction: { x: 0, y: up ? -1 : 1 },
    hand: { x1: x - 0.02, y1: y, x2: x + 0.02, y2: Math.min(1, y + 0.1) },
    at,
  };
}

function aim(target: "mug" | "pen", from: number, to: number) {
  const samples: TraceSample[] = [];
  for (let at = from; at <= to; at += 50) {
    samples.push(target === "mug" ? sample(0.2, 0.5, at) : sample(0.75, 0.3, at));
  }
  return samples;
}

const kinds = (samples: TraceSample[]) =>
  segmentVisits(samples, boxes).map((visit) =>
    visit.hit.kind === "box" ? (visit.hit.box === mug ? "mug" : "pen") : visit.hit.kind,
  );

describe("segmentVisits", () => {
  it("finds each product pointed at, in order, without needing a still finger", () => {
    const moving = [sample(0.4, 0.8, 500, false), sample(0.5, 0.75, 550, false), sample(0.6, 0.7, 600, false)];
    expect(kinds([...aim("mug", 0, 450), ...moving, ...aim("pen", 650, 1100)])).toEqual(["mug", "pen"]);
  });

  it("does not split a pointing on a short flicker away", () => {
    expect(kinds([...aim("mug", 0, 400), ...aim("pen", 450, 500), ...aim("mug", 550, 900)])).toEqual(["mug"]);
  });

  it("counts the same product again after pointing elsewhere", () => {
    expect(kinds([...aim("mug", 0, 400), ...aim("pen", 500, 900), ...aim("mug", 1000, 1400)])).toEqual([
      "mug",
      "pen",
      "mug",
    ]);
  });

  it("reports a still finger on empty space, but not a finger moving across it", () => {
    const still = [0, 100, 200, 300, 400, 500, 600, 700].map((at) => sample(0.5, 0.8, at, false));
    expect(kinds(still)).toEqual(["none"]);

    const moving = [0, 100, 200, 300, 400, 500, 600, 700].map((at, index) => sample(0.3 + index * 0.05, 0.8, at, false));
    expect(kinds(moving)).toEqual([]);
  });
});
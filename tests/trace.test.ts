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

const names = (samples: TraceSample[]) =>
  segmentVisits(samples, boxes).map((visit) =>
    visit.hit.kind === "box" ? (visit.hit.box === mug ? "mug" : "pen") : visit.hit.kind,
  );

describe("segmentVisits", () => {
  it("finds each product pointed at, in order, without needing a still finger", () => {
    const moving = [sample(0.4, 0.8, 500, false), sample(0.5, 0.75, 550, false), sample(0.6, 0.7, 600, false)];
    expect(names([...aim("mug", 0, 450), ...moving, ...aim("pen", 650, 1100)])).toEqual(["mug", "pen"]);
  });

  it("does not split a pointing on a short flicker away", () => {
    expect(names([...aim("mug", 0, 400), ...aim("pen", 450, 500), ...aim("mug", 550, 900)])).toEqual(["mug"]);
  });

  it("counts the same product again after pointing elsewhere", () => {
    expect(names([...aim("mug", 0, 400), ...aim("pen", 500, 900), ...aim("mug", 1000, 1400)])).toEqual([
      "mug",
      "pen",
      "mug",
    ]);
  });

  it("never counts the table, and skips a hand passing over a product", () => {
    const table = [0, 100, 200, 300, 400, 500, 600, 700].map((at) => sample(0.5, 0.8, at, false));
    expect(names(table)).toEqual([]);
    expect(names(aim("mug", 0, 200))).toEqual([]);
  });

  it("records a still finger aiming at empty space as a none visit paired in order with product visits", () => {
    const emptyPause = [0, 150, 300, 450, 600].map((at) => sample(0.45, 0.65, at, true));
    const mugPause = aim("mug", 900, 1400);
    expect(names([...emptyPause, ...mugPause])).toEqual(["none", "mug"]);
  });

  it("keeps five product visits in exact chronological order during a single hold", () => {
    const fiveBoxes = [
      { x1: 0.05, y1: 0.1, x2: 0.18, y2: 0.3 },
      { x1: 0.22, y1: 0.1, x2: 0.35, y2: 0.3 },
      { x1: 0.4, y1: 0.1, x2: 0.55, y2: 0.3 },
      { x1: 0.6, y1: 0.1, x2: 0.75, y2: 0.3 },
      { x1: 0.8, y1: 0.1, x2: 0.95, y2: 0.3 },
    ];
    const centers = [0.11, 0.28, 0.47, 0.67, 0.87];
    const allSamples: TraceSample[] = [];
    centers.forEach((x, idx) => {
      const start = idx * 600;
      for (let at = start; at <= start + 400; at += 100) {
        allSamples.push(sample(x, 0.38, at, true));
      }
    });
    const visits = segmentVisits(allSamples, fiveBoxes);
    expect(visits.map((v) => (v.hit.kind === "box" ? fiveBoxes.indexOf(v.hit.box) : -1))).toEqual([0, 1, 2, 3, 4]);
  });
});
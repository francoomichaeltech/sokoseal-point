import { describe, expect, it } from "vitest";
import { keepLongest } from "../lib/pointing/fit";

describe("keepLongest", () => {
  it("keeps everything when there are not more pointings than requests", () => {
    const items = [{ id: "a", duration: 100 }];
    expect(keepLongest(items, 2)).toBe(items);
  });

  it("drops the shortest extra pointings and keeps the order", () => {
    const items = [
      { id: "mug", duration: 900 },
      { id: "pass", duration: 320 },
      { id: "pen", duration: 700 },
      { id: "mug2", duration: 800 },
    ];
    expect(keepLongest(items, 3).map((item) => item.id)).toEqual(["mug", "pen", "mug2"]);
  });

  it("keeps five product pointings in order and drops a brief pass-over", () => {
    const items = [
      { id: "p1", duration: 600 },
      { id: "p2", duration: 550 },
      { id: "pass", duration: 320 },
      { id: "p3", duration: 550 },
      { id: "p4", duration: 650 },
      { id: "p5", duration: 580 },
    ];
    expect(keepLongest(items, 5).map((item) => item.id)).toEqual(["p1", "p2", "p3", "p4", "p5"]);
  });
});
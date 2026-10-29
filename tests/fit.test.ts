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
});
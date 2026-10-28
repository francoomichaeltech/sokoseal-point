import { describe, expect, it } from "vitest";
import { DwellDetector } from "../lib/pointing/dwell";

const hand = { x1: 0.4, y1: 0.6, x2: 0.6, y2: 1 };
const ray = (x: number) => ({ tip: { x, y: 0.5 }, direction: { x: 0, y: -1 }, hand });

describe("DwellDetector", () => {
  it("records a pause after 300 ms", () => {
    const detector = new DwellDetector();
    expect(detector.update(ray(0.5), 0)).toBeNull();
    expect(detector.update(ray(0.505), 150)).toBeNull();
    expect(detector.update(ray(0.5), 300)?.at).toBe(300);
  });

  it("records one pause per position", () => {
    const detector = new DwellDetector();
    detector.update(ray(0.5), 0);
    detector.update(ray(0.5), 300);
    for (let now = 400; now <= 1000; now += 100) expect(detector.update(ray(0.5), now)).toBeNull();
  });

  it("records again after the finger moves to another place", () => {
    const detector = new DwellDetector();
    detector.update(ray(0.5), 0);
    detector.update(ray(0.5), 300);
    expect(detector.update(ray(0.6), 400)).toBeNull();
    expect(detector.update(ray(0.6), 700)?.tip.x).toBe(0.6);
  });

  it("ignores a moving finger", () => {
    const detector = new DwellDetector();
    for (let i = 0; i <= 10; i += 1) expect(detector.update(ray(0.1 + i * 0.05), i * 50)).toBeNull();
  });

  it("restarts the pause after a long tracking loss", () => {
    const detector = new DwellDetector();
    detector.update(ray(0.5), 0);
    detector.update(null, 400);
    expect(detector.update(ray(0.5), 450)).toBeNull();
    expect(detector.update(ray(0.5), 600)).toBeNull();
  });
});
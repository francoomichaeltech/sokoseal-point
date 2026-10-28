import type { Box, Point } from "@/lib/grounding/types";

/** Smoothed fingertip, pointing direction and hand bounds in normalized frame coordinates. */
export type Ray = { tip: Point; direction: Point; hand: Box };

export type Dwell = Ray & { at: number };

// A pause this long while speaking counts as pointing at something.
const DWELL_MS = 300;
const STILL_RADIUS = 0.025;
// After a pause is recorded, the fingertip must move this far before another one counts.
const REARM_RADIUS = 0.06;
// Tracking dropouts shorter than this do not reset a pause in progress.
const COAST_MS = 250;

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class DwellDetector {
  private anchor: { tip: Point; since: number } | null = null;
  private last: Point | null = null;
  private lastSeen = -Infinity;

  update(ray: Ray | null, now: number): Dwell | null {
    if (!ray) {
      if (now - this.lastSeen > COAST_MS) {
        this.anchor = null;
        this.last = null;
      }
      return null;
    }
    this.lastSeen = now;

    if (this.last) {
      if (distance(ray.tip, this.last) < REARM_RADIUS) return null;
      this.last = null;
    }

    if (!this.anchor || distance(ray.tip, this.anchor.tip) > STILL_RADIUS) {
      this.anchor = { tip: ray.tip, since: now };
      return null;
    }
    if (now - this.anchor.since < DWELL_MS) return null;

    this.anchor = null;
    this.last = ray.tip;
    return { ...ray, at: now };
  }
}
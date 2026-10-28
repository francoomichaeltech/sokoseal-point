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

// A finger that wobbles on a large product can pass REARM_RADIUS and record a second pause
// for the same point. Pauses close in place and time are treated as one.
const MERGE_RADIUS = 0.1;
const MERGE_GAP_MS = 1_200;

export function mergeDwells(dwells: Dwell[]): Dwell[] {
  const merged: Dwell[] = [];

  for (const dwell of dwells) {
    const last = merged.at(-1);
    if (last && dwell.at - last.at <= MERGE_GAP_MS && distance(dwell.tip, last.tip) <= MERGE_RADIUS) continue;
    merged.push(dwell);
  }

  return merged;
}
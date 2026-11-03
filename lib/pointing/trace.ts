import type { Box, Point } from "@/lib/grounding/types";
import type { Ray } from "./dwell";
import { resolveDwell } from "./resolve";

export type TraceSample = Ray & { at: number };

export type Hit = { kind: "box"; box: Box } | { kind: "ambiguous" } | { kind: "none" };

export type Visit = { hit: Hit; tip: Point; start: number; end: number };

// Missed frames shorter than this keep a run going.
const MAX_GAP_MS = 250;
// Aiming at one product this long counts as pointing at it. It skips the hand passing over a product
// on the way in or out; the finger does not need to be still.
const MIN_VISIT_MS = 300;
// A still finger aiming at empty counter space for this long counts as a "nothing there" visit.
const MIN_EMPTY_VISIT_MS = 450;
const STILL_EMPTY_RADIUS = 0.035;
const NEAR_VISIT_RADIUS = 0.08;
// A short flicker away from a product does not split one pointing into two.
const REJOIN_MS = 500;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isAimingAtCounter(sample: TraceSample): boolean {
  const dirLen = Math.hypot(sample.direction.x, sample.direction.y);
  return dirLen > 0 && sample.direction.y <= 0.2;
}

function hitFor(boxes: Box[], sample: TraceSample): Hit | null {
  const selection = resolveDwell(boxes, sample);
  if (selection.status === "MATCH") return { kind: "box", box: selection.box };
  if (selection.status === "AMBIGUOUS") return { kind: "ambiguous" };
  return isAimingAtCounter(sample) ? { kind: "none" } : null;
}

function sameHit(a: Hit, b: Hit) {
  if (a.kind !== b.kind) return false;
  return a.kind !== "box" || (b.kind === "box" && a.box === b.box);
}

function mean(points: Point[]): Point {
  const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/** Products (or still empty-space pauses) pointed at, in order. Samples must be sorted by time. */
export function segmentVisits(samples: TraceSample[], boxes: Box[]): Visit[] {
  type Run = { hit: Hit; start: number; end: number; tips: Point[]; anchor: Point };
  const runs: Run[] = [];

  for (const sample of samples) {
    const hit = hitFor(boxes, sample);
    if (!hit) continue;

    const last = runs.at(-1);
    const sameStillEmpty =
      hit.kind === "none" ? (last ? distance(sample.tip, last.anchor) <= STILL_EMPTY_RADIUS : true) : true;

    if (last && sameHit(last.hit, hit) && sample.at - last.end <= MAX_GAP_MS && sameStillEmpty) {
      last.end = sample.at;
      last.tips.push(sample.tip);
    } else {
      runs.push({ hit, start: sample.at, end: sample.at, tips: [sample.tip], anchor: sample.tip });
    }
  }

  // First merge product/ambiguous visits across brief flickers, then include distinct still empty-space visits.
  const rawVisits: Visit[] = [];
  for (const run of runs) {
    const minDuration = run.hit.kind === "none" ? MIN_EMPTY_VISIT_MS : MIN_VISIT_MS;
    if (run.end - run.start < minDuration) continue;
    rawVisits.push({ hit: run.hit, tip: mean(run.tips), start: run.start, end: run.end });
  }

  const objectVisits = rawVisits.filter((v) => v.hit.kind !== "none");
  const filtered: Visit[] = rawVisits.filter((visit) => {
    if (visit.hit.kind !== "none") return true;
    // Ignore an empty-space wobble that sits at the same spot as an object visit.
    return !objectVisits.some((obj) => distance(obj.tip, visit.tip) <= NEAR_VISIT_RADIUS);
  });

  const visits: Visit[] = [];
  for (const visit of filtered) {
    const last = visits.at(-1);
    if (
      last &&
      sameHit(last.hit, visit.hit) &&
      visit.start - last.end <= (visit.hit.kind === "none" ? REJOIN_MS * 2 : REJOIN_MS) &&
      (visit.hit.kind !== "none" || distance(last.tip, visit.tip) <= NEAR_VISIT_RADIUS)
    ) {
      last.end = visit.end;
      continue;
    }
    visits.push({ ...visit });
  }

  return visits;
}
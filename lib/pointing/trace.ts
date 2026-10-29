import type { Box, Point } from "@/lib/grounding/types";
import type { Ray } from "./dwell";
import { resolveDwell } from "./resolve";

export type TraceSample = Ray & { at: number };

export type Hit = { kind: "box"; box: Box } | { kind: "ambiguous" } | { kind: "none" };

export type Visit = { hit: Hit; tip: Point; start: number; end: number };

// Missed frames shorter than this keep a run going.
const MAX_GAP_MS = 250;
// Aiming at the same product this long counts as pointing at it; the finger does not need to be still.
const MIN_VISIT_MS = 250;
// Empty space only counts when the finger is held still there, so moving between products is ignored.
const MIN_EMPTY_MS = 600;
const STILL_SPREAD = 0.04;
// A short flicker away from a product does not split one pointing into two.
const REJOIN_MS = 500;

function hitFor(boxes: Box[], sample: TraceSample): Hit {
  const selection = resolveDwell(boxes, sample);
  if (selection.status === "MATCH") return { kind: "box", box: selection.box };
  return selection.status === "AMBIGUOUS" ? { kind: "ambiguous" } : { kind: "none" };
}

function sameHit(a: Hit, b: Hit) {
  if (a.kind !== b.kind) return false;
  return a.kind !== "box" || (b.kind === "box" && a.box === b.box);
}

function mean(points: Point[]): Point {
  const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function spread(points: Point[]) {
  const center = mean(points);
  return Math.max(...points.map((point) => Math.hypot(point.x - center.x, point.y - center.y)));
}

/** Splits a fingertip trace into the products (or empty spots) pointed at, in order. Samples must be sorted by time. */
export function segmentVisits(samples: TraceSample[], boxes: Box[]): Visit[] {
  type Run = { hit: Hit; start: number; end: number; tips: Point[] };
  const runs: Run[] = [];

  for (const sample of samples) {
    const hit = hitFor(boxes, sample);
    const last = runs.at(-1);
    if (last && sameHit(last.hit, hit) && sample.at - last.end <= MAX_GAP_MS) {
      last.end = sample.at;
      last.tips.push(sample.tip);
    } else {
      runs.push({ hit, start: sample.at, end: sample.at, tips: [sample.tip] });
    }
  }

  const visits: Visit[] = [];
  for (const run of runs) {
    const duration = run.end - run.start;
    const counts =
      run.hit.kind === "none"
        ? duration >= MIN_EMPTY_MS && spread(run.tips) <= STILL_SPREAD
        : duration >= MIN_VISIT_MS;
    if (!counts) continue;

    const last = visits.at(-1);
    if (last && sameHit(last.hit, run.hit) && run.start - last.end <= REJOIN_MS) {
      last.end = run.end;
      continue;
    }
    visits.push({ hit: run.hit, tip: mean(run.tips), start: run.start, end: run.end });
  }

  return visits;
}
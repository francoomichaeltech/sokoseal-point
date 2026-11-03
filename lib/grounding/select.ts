import type { Box, Point, Selection } from "./types";

// Lets a point on the edge of a thin object (a pen) still count.
const EDGE_TOLERANCE = 0.01;

// A point inside a small box that sits within a much larger one targets the small one.
const NESTED_AREA_RATIO = 0.5;

// SAM also detects the pointing hand (or hand and arm). A box that covers most of the
// tracked hand is ignored.
const HAND_COVERAGE = 0.75;
const MIN_BOX_SIDE = 0.015;
const MIN_BOX_AREA = 0.001;
const MAX_BOX_AREA = 0.55;
const DUPLICATE_IOU = 0.8;

const RAY_STEP = 0.01;

export type RayHit = { selection: Selection; at: Point | null };

function area(box: Box) {
  return Math.max(0, box.x2 - box.x1) * Math.max(0, box.y2 - box.y1);
}

function intersection(a: Box, b: Box) {
  const width = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const height = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  return width * height;
}

function iou(a: Box, b: Box): number {
  const inter = intersection(a, b);
  if (inter <= 0) return 0;
  const union = area(a) + area(b) - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Drops boxes covering most of the frame (table, shadows) and tiny noise, and merges near-duplicates.
 */
export function cleanBoxes(boxes: Box[]): Box[] {
  const filtered = boxes.filter((box) => {
    const width = box.x2 - box.x1;
    const height = box.y2 - box.y1;
    const boxArea = width * height;
    if (width < MIN_BOX_SIDE || height < MIN_BOX_SIDE || boxArea < MIN_BOX_AREA) return false;
    if (boxArea > MAX_BOX_AREA || (width > 0.92 && height > 0.75)) return false;
    return true;
  });

  const merged: Box[] = [];
  for (const box of filtered) {
    const existingIndex = merged.findIndex((candidate) => iou(candidate, box) >= DUPLICATE_IOU);
    if (existingIndex >= 0) {
      const prev = merged[existingIndex];
      merged[existingIndex] = {
        x1: Math.min(prev.x1, box.x1),
        y1: Math.min(prev.y1, box.y1),
        x2: Math.max(prev.x2, box.x2),
        y2: Math.max(prev.y2, box.y2),
      };
    } else {
      merged.push(box);
    }
  }

  return merged;
}

function contains(box: Box, point: Point) {
  return (
    point.x >= box.x1 - EDGE_TOLERANCE &&
    point.x <= box.x2 + EDGE_TOLERANCE &&
    point.y >= box.y1 - EDGE_TOLERANCE &&
    point.y <= box.y2 + EDGE_TOLERANCE
  );
}

function isInside(point: Point) {
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

export function selectTarget(boxes: Box[], point: Point): Selection {
  const hits = boxes.filter((box) => contains(box, point)).sort((a, b) => area(a) - area(b));

  if (hits.length === 0) return { status: "NONE" };
  if (hits.length === 1 || area(hits[0]) <= NESTED_AREA_RATIO * area(hits[1])) {
    return { status: "MATCH", box: hits[0] };
  }
  // Two similarly sized candidates: ask the user instead of guessing.
  return { status: "AMBIGUOUS", boxes: hits };
}

export function withoutHand(boxes: Box[], hand?: Box): Box[] {
  const handArea = hand ? area(hand) : 0;
  if (!hand || handArea <= 0) return boxes;
  return boxes.filter((box) => intersection(box, hand) / handArea < HAND_COVERAGE);
}

// Walks from the fingertip along the pointing direction (up to maxDistance when given) and stops at the first object it meets.
export function castRay(boxes: Box[], tip: Point, direction: Point, maxDistance = Infinity): RayHit {
  const length = Math.hypot(direction.x, direction.y);
  if (!length) return { selection: { status: "NONE" }, at: null };

  const step = { x: (direction.x / length) * RAY_STEP, y: (direction.y / length) * RAY_STEP };

  for (
    let point = tip, travelled = 0;
     isInside(point) && travelled <= maxDistance + 1e-9;
    point = { x: point.x + step.x, y: point.y + step.y }, travelled += RAY_STEP
  ) {
    const selection = selectTarget(boxes, point);
    if (selection.status !== "NONE") return { selection, at: point };
  }
  return { selection: { status: "NONE" }, at: null };
}

export function selectAlongRay(boxes: Box[], tip: Point, direction: Point, hand?: Box, maxDistance = Infinity): Selection {
  return castRay(withoutHand(boxes, hand), tip, direction, maxDistance).selection;
}
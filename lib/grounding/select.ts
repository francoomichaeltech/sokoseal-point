import type { Box, Point, Selection } from "./types";

// Lets a point on the edge of a thin object (a pen) still count.
const EDGE_TOLERANCE = 0.01;

// A point inside a small box that sits within a much larger one targets the small one.
const NESTED_AREA_RATIO = 0.5;

// SAM also detects the pointing hand (or hand and arm). A box that covers most of the
// tracked hand is treated as the hand and ignored.
const HAND_COVERAGE = 0.75;

const RAY_STEP = 0.01;

export type RayHit = { selection: Selection; at: Point | null };

function area(box: Box) {
  return (box.x2 - box.x1) * (box.y2 - box.y1);
}

function intersection(a: Box, b: Box) {
  const width = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const height = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  return width * height;
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

// Walks from the fingertip towards the frame edge and stops at the first object it meets.
export function castRay(boxes: Box[], tip: Point, direction: Point): RayHit {
  const length = Math.hypot(direction.x, direction.y);
  if (!length) return { selection: { status: "NONE" }, at: null };

  const step = { x: (direction.x / length) * RAY_STEP, y: (direction.y / length) * RAY_STEP };

  for (let point = tip; isInside(point); point = { x: point.x + step.x, y: point.y + step.y }) {
    const selection = selectTarget(boxes, point);
    if (selection.status !== "NONE") return { selection, at: point };
  }
  return { selection: { status: "NONE" }, at: null };
}

export function selectAlongRay(boxes: Box[], tip: Point, direction: Point, hand?: Box): Selection {
  return castRay(withoutHand(boxes, hand), tip, direction).selection;
}
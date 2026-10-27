import type { Box, Point, Selection } from "./types";

// Lets a tap on the edge of a thin object (a pen) still count.
const EDGE_TOLERANCE = 0.01;

// A tap inside a small box that sits within a much larger one targets the small one.
const NESTED_AREA_RATIO = 0.5;

function area(box: Box) {
  return (box.x2 - box.x1) * (box.y2 - box.y1);
}

function contains(box: Box, point: Point) {
  return (
    point.x >= box.x1 - EDGE_TOLERANCE &&
    point.x <= box.x2 + EDGE_TOLERANCE &&
    point.y >= box.y1 - EDGE_TOLERANCE &&
    point.y <= box.y2 + EDGE_TOLERANCE
  );
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
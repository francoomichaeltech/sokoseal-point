import { castRay, withoutHand } from "@/lib/grounding/select";
import type { Box, Point, Selection } from "@/lib/grounding/types";
import type { Ray } from "./dwell";

// Spike 01: pointing often lands just beside the product, so a near miss still counts.
export const NEAREST_LIMIT = 0.068;
// Two objects whose distances differ by less than this are equally likely targets.
const AMBIGUITY_MARGIN = 0.02;
const HAND_TO_FINGER_RATIO = 0.35;
const MIN_FINGER_LENGTH = 0.075;
const RAY_FINGER_MULTIPLIER = 1.35;

function distanceToBox(box: Box, point: Point) {
  const dx = Math.max(box.x1 - point.x, 0, point.x - box.x2);
  const dy = Math.max(box.y1 - point.y, 0, point.y - box.y2);
  return Math.hypot(dx, dy);
}

export function maxRayReach(ray: Ray): number {
  const handDiag = Math.hypot(ray.hand.x2 - ray.hand.x1, ray.hand.y2 - ray.hand.y1);
  const fingerLength = ray.fingerLength ?? Math.max(MIN_FINGER_LENGTH, handDiag * HAND_TO_FINGER_RATIO);
  return fingerLength * RAY_FINGER_MULTIPLIER;
}

export function nearestBox(boxes: Box[], point: Point, limit = NEAREST_LIMIT): Selection {
  const ranked = boxes
    .map((box) => ({ box, distance: distanceToBox(box, point) }))
    .filter((item) => item.distance <= limit)
    .sort((a, b) => a.distance - b.distance);

  if (ranked.length === 0) return { status: "NONE" };
  if (ranked.length > 1 && ranked[1].distance - ranked[0].distance < AMBIGUITY_MARGIN) {
    return { status: "AMBIGUOUS", boxes: [ranked[0].box, ranked[1].box] };
  }
  return { status: "MATCH", box: ranked[0].box };
}

// Follows the finger up to a distance proportional to finger length. If the ray passes beside
// every object, the object closest to the fingertip within the limit is used.
export function resolveDwell(boxes: Box[], ray: Ray): Selection {
  const candidates = withoutHand(boxes, ray.hand, ray.tip);
  const hit = castRay(candidates, ray.tip, ray.direction, maxRayReach(ray)).selection;
  return hit.status !== "NONE" ? hit : nearestBox(candidates, ray.tip);
}
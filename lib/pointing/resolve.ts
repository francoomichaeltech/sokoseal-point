import { castRay, selectTarget, withoutHand } from "@/lib/grounding/select";
import type { Box, Point, Selection } from "@/lib/grounding/types";
import type { Ray } from "./dwell";

// A fingertip on or right next to a product decides before casting the ray.
export const TOUCH_LIMIT = 0.04;
// Spike 01: pointing often lands just beside the product, so a near miss still counts.
export const NEAREST_LIMIT = 0.068;
// Two objects whose distances differ by less than this are equally likely targets.
const AMBIGUITY_MARGIN = 0.02;
const NESTED_AREA_RATIO = 0.5;
const HAND_TO_FINGER_RATIO = 0.35;
const MIN_FINGER_LENGTH = 0.075;
const RAY_FINGER_MULTIPLIER = 1.35;

function boxArea(box: Box) {
  return (box.x2 - box.x1) * (box.y2 - box.y1);
}

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
    .map((box) => ({ box, distance: distanceToBox(box, point), area: boxArea(box) }))
    .filter((item) => item.distance <= limit)
    .sort((a, b) => a.distance - b.distance || a.area - b.area);

  if (ranked.length === 0) return { status: "NONE" };
  if (ranked.length > 1 && ranked[1].distance - ranked[0].distance < AMBIGUITY_MARGIN) {
    // A small object nested inside a much larger one at the fingertip targets the small object.
    if (ranked[0].distance === 0 && ranked[1].distance === 0 && ranked[0].area <= NESTED_AREA_RATIO * ranked[1].area) {
      return { status: "MATCH", box: ranked[0].box };
    }
    return { status: "AMBIGUOUS", boxes: [ranked[0].box, ranked[1].box] };
  }
  return { status: "MATCH", box: ranked[0].box };
}

// A fingertip on or right next to a product decides before the ray; equally close candidates are
// ambiguous, not guessed. Otherwise follows the finger up to a distance proportional to finger length.
export function resolveDwell(boxes: Box[], ray: Ray): Selection {
  const candidates = withoutHand(boxes, ray.hand);

  const direct = selectTarget(candidates, ray.tip);
  const adjacent = nearestBox(candidates, ray.tip, TOUCH_LIMIT);
  if (adjacent.status === "AMBIGUOUS") return adjacent;
  if (direct.status !== "NONE") return direct;
  if (adjacent.status === "MATCH") return adjacent;

  const hit = castRay(candidates, ray.tip, ray.direction, maxRayReach(ray)).selection;
  return hit.status !== "NONE" ? hit : nearestBox(candidates, ray.tip);
}
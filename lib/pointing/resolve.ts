import { castRay, selectTarget, withoutHand } from "@/lib/grounding/select";
import type { Box, Point, Selection } from "@/lib/grounding/types";
import type { Ray } from "./dwell";

// A fingertip on or right next to a product decides before casting the ray.
export const TOUCH_LIMIT = 0.04;
// Spike 01: pointing often lands just beside the product, so a near miss still counts.
export const NEAREST_LIMIT = 0.068;
// When a box is only matched via nearest-box fallback (not inside box or ray), ignore it if the finger points away from it.
const FALLBACK_TOUCH_LIMIT = 0.025;
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

function isBoxInFrontOfTip(box: Box, tip: Point, direction: Point): boolean {
  const dist = distanceToBox(box, tip);
  if (dist <= FALLBACK_TOUCH_LIMIT) return true;
  const dirLen = Math.hypot(direction.x, direction.y);
  if (dirLen === 0) return true;
  const clampedX = Math.max(box.x1, Math.min(tip.x, box.x2));
  const clampedY = Math.max(box.y1, Math.min(tip.y, box.y2));
  const vx = clampedX - tip.x;
  const vy = clampedY - tip.y;
  const vLen = Math.hypot(vx, vy);
  if (vLen === 0) return true;
  // Cosine between pointing vector and vector from tip to nearest point on box.
  const cos = (vx * direction.x + vy * direction.y) / (vLen * dirLen);
  return cos >= -0.25;
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
  const forwardCandidates = candidates.filter((box) => isBoxInFrontOfTip(box, ray.tip, ray.direction));

  const direct = selectTarget(candidates, ray.tip);
  const adjacent = nearestBox(forwardCandidates, ray.tip, TOUCH_LIMIT);
  if (adjacent.status === "AMBIGUOUS") return adjacent;
  if (direct.status !== "NONE") return direct;
  if (adjacent.status === "MATCH") return adjacent;

  const hit = castRay(candidates, ray.tip, ray.direction, maxRayReach(ray)).selection;
  return hit.status !== "NONE" ? hit : nearestBox(forwardCandidates, ray.tip);
}
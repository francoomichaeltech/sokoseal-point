import type { Box, Point } from "@/lib/grounding/types";

// MediaPipe hand landmark indices.
const INDEX_MCP = 5;
const INDEX_TIP = 8;

// Index fingers shorter than this on screen are too distant or foreshortened to aim with.
const MIN_AIM_LENGTH = 0.015;

/** Raw aim of a visible hand, before smoothing. */
export type Aim = { tip: Point; base: Point; hand: Box };

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function bounds(landmarks: readonly Point[]): Box {
  const xs = landmarks.map((point) => point.x);
  const ys = landmarks.map((point) => point.y);
  return {
    x1: clamp(Math.min(...xs)),
    y1: clamp(Math.min(...ys)),
    x2: clamp(Math.max(...xs)),
    y2: clamp(Math.max(...ys)),
  };
}

// Any visible hand aims along its index finger; the pose does not have to be a strict point.
export function readAim(landmarks: readonly Point[]): Aim | null {
  if (landmarks.length < 21) return null;

  const tip = landmarks[INDEX_TIP];
  const base = landmarks[INDEX_MCP];
  if (Math.hypot(tip.x - base.x, tip.y - base.y) < MIN_AIM_LENGTH) return null;

  return {
    tip: { x: clamp(tip.x), y: clamp(tip.y) },
    base: { x: base.x, y: base.y },
    hand: bounds(landmarks),
  };
}
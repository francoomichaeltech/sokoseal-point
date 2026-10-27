import type { Box, Point, Pointer } from "@/lib/grounding/types";

// MediaPipe hand landmark indices.
const WRIST = 0;
const INDEX_MCP = 5;
const INDEX_PIP = 6;
const INDEX_TIP = 8;
// [middle joint, tip] of the middle, ring and little fingers.
const OTHER_FINGERS = [
  [10, 12],
  [14, 16],
  [18, 20],
] as const;

// The index tip must be this much further from the wrist than its middle joint to count as straight.
const EXTENDED_RATIO = 1.1;
// Shorter fingers are too distant or foreshortened to give a stable direction.
const MIN_FINGER_LENGTH = 0.03;

export type HandPointer = Required<Pointer>;

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Returns the pointing ray of a hand, or null if the hand is not making a pointing gesture.
export function readPointer(landmarks: readonly Point[]): HandPointer | null {
  if (landmarks.length < 21) return null;

  const wrist = landmarks[WRIST];
  const tip = landmarks[INDEX_TIP];
  const pip = landmarks[INDEX_PIP];
  const mcp = landmarks[INDEX_MCP];

  const indexStraight = distance(tip, wrist) > distance(pip, wrist) * EXTENDED_RATIO;
  const folded = OTHER_FINGERS.filter(
    ([joint, end]) => distance(landmarks[end], wrist) < distance(landmarks[joint], wrist),
  ).length;
  if (!indexStraight || folded < 2) return null;

  const dx = tip.x - mcp.x;
  const dy = tip.y - mcp.y;
  const length = Math.hypot(dx, dy);
  if (length < MIN_FINGER_LENGTH) return null;

  const xs = landmarks.map((point) => point.x);
  const ys = landmarks.map((point) => point.y);
  const hand: Box = {
    x1: clamp(Math.min(...xs)),
    y1: clamp(Math.min(...ys)),
    x2: clamp(Math.max(...xs)),
    y2: clamp(Math.max(...ys)),
  };

  return {
    tip: { x: clamp(tip.x), y: clamp(tip.y) },
    direction: { x: dx / length, y: dy / length },
    hand,
  };
}
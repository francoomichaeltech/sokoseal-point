/** Normalized to the captured frame: 0..1 on both axes, origin top-left. */
export type Point = { x: number; y: number };

/** Normalized like Point. */
export type Box = { x1: number; y1: number; x2: number; y2: number };

export type Selection =
  | { status: "MATCH"; box: Box }
  | { status: "AMBIGUOUS"; boxes: Box[] }
  | { status: "NONE" };

export type GroundingResult = (Selection | { status: "ERROR" }) & { latencyMs?: number };
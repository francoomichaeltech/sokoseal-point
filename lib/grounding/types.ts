/** Normalized to the captured frame: 0..1 on both axes, origin top-left. */
export type Point = { x: number; y: number };

/** Normalized like Point. */
export type Box = { x1: number; y1: number; x2: number; y2: number };

/** Where the user is pointing. Without a direction, the tip itself is the target. */
export type Pointer = { tip: Point; direction?: Point; hand?: Box };

export type Selection =
  | { status: "MATCH"; box: Box }
  | { status: "AMBIGUOUS"; boxes: Box[] }
  | { status: "NONE" };

export type GroundingResult = (Selection | { status: "ERROR" }) & { latencyMs?: number };

export type ScanResult =
  | { status: "OK"; boxes: Box[]; latencyMs: number }
  | { status: "ERROR"; latencyMs: number };
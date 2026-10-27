import { segment } from "@/lib/meta/sam";
import { parseBoxes } from "./parse";
import { selectAlongRay, selectTarget } from "./select";
import type { GroundingResult, Pointer, ScanResult } from "./types";

// From spike 01: "object" returned every product on a real counter and nothing on an
// empty table, while product-specific words were unreliable.
const CONCEPT = "object";

/** Every object in the frame. The client resolves pointing against these locally. */
export async function scanObjects(image: string): Promise<ScanResult> {
  const started = Date.now();

  try {
    const boxes = parseBoxes(await segment(image, CONCEPT));
    return { status: "OK", boxes, latencyMs: Date.now() - started };
  } catch (error) {
    console.error("[scan] segmentation failed:", error instanceof Error ? error.message : error);
    return { status: "ERROR", latencyMs: Date.now() - started };
  }
}

export async function ground(image: string, pointer: Pointer): Promise<GroundingResult> {
  const scan = await scanObjects(image);
  if (scan.status === "ERROR") return scan;

  const selection = pointer.direction
    ? selectAlongRay(scan.boxes, pointer.tip, pointer.direction, pointer.hand)
    : selectTarget(scan.boxes, pointer.tip);
  return { ...selection, latencyMs: scan.latencyMs };
}
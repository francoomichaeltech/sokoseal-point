import { segment } from "@/lib/meta/sam";
import { parseBoxes } from "./parse";
import { selectAlongRay, selectTarget } from "./select";
import type { GroundingResult, Pointer } from "./types";

// From spike 01: "object" returned every product on a real counter and nothing on an
// empty table, while product-specific words were unreliable.
const CONCEPT = "object";

export async function ground(image: string, pointer: Pointer): Promise<GroundingResult> {
  const started = Date.now();

  try {
    const boxes = parseBoxes(await segment(image, CONCEPT));
    const selection = pointer.direction
      ? selectAlongRay(boxes, pointer.tip, pointer.direction, pointer.hand)
      : selectTarget(boxes, pointer.tip);
    return { ...selection, latencyMs: Date.now() - started };
  } catch (error) {
    console.error("[ground] segmentation failed:", error instanceof Error ? error.message : error);
    return { status: "ERROR", latencyMs: Date.now() - started };
  }
}
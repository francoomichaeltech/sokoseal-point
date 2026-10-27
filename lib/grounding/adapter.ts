import { segment } from "@/lib/meta/sam";
import { parseBoxes } from "./parse";
import { selectTarget } from "./select";
import type { GroundingResult, Point } from "./types";

// From spike 01: "object" returned every product on a real counter and nothing on an
// empty table, while product-specific words were unreliable.
const CONCEPT = "object";

export async function groundTap(image: string, point: Point): Promise<GroundingResult> {
  const started = Date.now();

  try {
    const boxes = parseBoxes(await segment(image, CONCEPT));
    return { ...selectTarget(boxes, point), latencyMs: Date.now() - started };
  } catch (error) {
    console.error("[ground] segmentation failed:", error instanceof Error ? error.message : error);
    return { status: "ERROR", latencyMs: Date.now() - started };
  }
}
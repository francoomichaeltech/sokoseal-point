import { segment } from "@/lib/meta/sam";
import { parseBoxes } from "./parse";
import type { ScanResult } from "./types";

// "object" returns every product on a real counter and nothing on an empty table,
// whereas product-specific words are unreliable.
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
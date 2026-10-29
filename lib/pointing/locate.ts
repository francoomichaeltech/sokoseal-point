import type { Product } from "@/lib/catalogue/types";
import type { PointedTarget } from "@/lib/commerce/types";
import type { ScanResult } from "@/lib/grounding/types";
import { identifyTargets } from "@/lib/identity/identify-targets";
import type { TargetIdentity } from "@/lib/identity/types";
import type { Frame } from "@/lib/media/capture";
import { segmentVisits, type TraceSample } from "./trace";

export type Scan = { result: ScanResult; frame: Frame };

/** One pointing at a product: what it was and how long the finger stayed on it. */
export type PointedMark = { target: PointedTarget; name: string | null; duration: number };

export type Located = { marks: PointedMark[]; objectCount: number; handSeen: boolean };

function fromIdentity(identity: TargetIdentity | undefined): PointedTarget {
  switch (identity?.state) {
    case "product":
      return { state: "product", sku: identity.sku };
    case "unknown":
      return { state: "unknown" };
    case "ambiguous":
      return { state: "ambiguous" };
    default:
      return { state: "error" };
  }
}

// Resolves the fingertip trace to the products pointed at, in order, then to catalogue products.
export async function locateTargets(
  scan: Promise<Scan> | null,
  samples: TraceSample[],
  products: Product[],
): Promise<Located> {
  const handSeen = samples.length > 0;
  const failed: Located = { marks: [], objectCount: 0, handSeen };
  if (!scan) return failed;

  try {
    const { result, frame } = await scan;
    if (result.status !== "OK") return failed;

    const sorted = [...samples].sort((a, b) => a.at - b.at);
    const visits = segmentVisits(sorted, result.boxes);
    // One identity check per object, even if it was pointed at more than once.
    const boxes = [...new Set(visits.flatMap((visit) => (visit.hit.kind === "box" ? [visit.hit.box] : [])))];
    const identities = boxes.length > 0 ? await identifyTargets(frame.url, boxes, products) : [];

    const marks = visits.map((visit): PointedMark => {
      const duration = visit.end - visit.start;
      if (visit.hit.kind === "ambiguous") return { target: { state: "ambiguous" }, name: null, duration };

      const identity = identities[boxes.indexOf(visit.hit.box)];
      return {
        target: fromIdentity(identity),
        name: identity?.state === "product" ? identity.name : null,
        duration,
      };
    });

    return { marks, objectCount: result.boxes.length, handSeen };
  } catch {
    return failed;
  }
}
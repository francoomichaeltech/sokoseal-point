import type { Product } from "@/lib/catalogue/types";
import type { PointedTarget } from "@/lib/commerce/types";
import type { Box, Point, ScanResult } from "@/lib/grounding/types";
import { identifyTargets } from "@/lib/identity/identify-targets";
import type { TargetIdentity } from "@/lib/identity/types";
import type { Frame } from "@/lib/media/capture";
import { segmentVisits, type TraceSample } from "./trace";

export type Scan = { result: ScanResult; frame: Frame };

export type EvidenceMark = { tip: Point; box: Box | null; target: PointedTarget; name: string | null };

/** The scanned counter and where each pointing landed, shown to the user for review. */
export type Evidence = { frameUrl: string; width: number; height: number; marks: EvidenceMark[] };

export type Located = { targets: PointedTarget[]; objectCount: number; handSeen: boolean; evidence: Evidence | null };

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
  const failed: Located = { targets: [], objectCount: 0, handSeen, evidence: null };
  if (!scan) return failed;

  try {
    const { result, frame } = await scan;
    if (result.status !== "OK") return failed;

    const sorted = [...samples].sort((a, b) => a.at - b.at);
    const visits = segmentVisits(sorted, result.boxes);
    // One identity check per object, even if it was pointed at more than once.
    const boxes = [...new Set(visits.flatMap((visit) => (visit.hit.kind === "box" ? [visit.hit.box] : [])))];
    const identities = boxes.length > 0 ? await identifyTargets(frame.url, boxes, products) : [];

    const marks = visits.map((visit): EvidenceMark => {
      if (visit.hit.kind === "none") return { tip: visit.tip, box: null, target: { state: "none" }, name: null };
      if (visit.hit.kind === "ambiguous") {
        return { tip: visit.tip, box: null, target: { state: "ambiguous" }, name: null };
      }
      const identity = identities[boxes.indexOf(visit.hit.box)];
      return {
        tip: visit.tip,
        box: visit.hit.box,
        target: fromIdentity(identity),
        name: identity?.state === "product" ? identity.name : null,
      };
    });

    return {
      targets: marks.map((mark) => mark.target),
      objectCount: result.boxes.length,
      handSeen,
      evidence: { frameUrl: frame.url, width: frame.width, height: frame.height, marks },
    };
  } catch {
    return failed;
  }
}
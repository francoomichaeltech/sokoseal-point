import type { Product } from "@/lib/catalogue/types";
import type { PointedTarget } from "@/lib/commerce/types";
import { cleanBoxes } from "@/lib/grounding/select";
import type { Box, Point, ScanResult } from "@/lib/grounding/types";
import { identifyTargets } from "@/lib/identity/identify-targets";
import type { TargetIdentity } from "@/lib/identity/types";
import { pickBestFrame, type Frame } from "@/lib/media/capture";
import { segmentVisits, type TraceSample, type Visit } from "./trace";
import type { Keyframe } from "./use-pointing-session";

export type Scan = { result: ScanResult; frame: Frame };

/** Per-scan cache of in-flight or resolved product identities for boxes visited during a hold. */
export type ScanIdentityCache = {
  frameUrl: string;
  entries: Map<string, Promise<TargetIdentity>>;
};

export function boxCacheKey(box: Box): string {
  return `${box.x1.toFixed(4)},${box.y1.toFixed(4)},${box.x2.toFixed(4)},${box.y2.toFixed(4)}`;
}

export function createScanIdentityCache(frameUrl: string): ScanIdentityCache {
  return { frameUrl, entries: new Map() };
}

/**
 * Starts identifying pointed objects during the hold as soon as a visit is detected,
 * caching each box's identity promise per scan so release reuses it immediately.
 */
export function preIdentifyVisits(
  scan: Scan,
  samples: TraceSample[],
  products: Product[],
  cache: ScanIdentityCache,
  identifyFn: typeof identifyTargets = identifyTargets,
): void {
  if (scan.result.status !== "OK" || cache.frameUrl !== scan.frame.url || products.length === 0) return;

  const sorted = [...samples].sort((a, b) => a.at - b.at);
  const cleaned = cleanBoxes(scan.result.boxes);
  const visits = segmentVisits(sorted, cleaned);

  for (const visit of visits) {
    if (visit.hit.kind !== "box") continue;
    const box = visit.hit.box;
    const key = boxCacheKey(box);
    if (!cache.entries.has(key)) {
      const pending = identifyFn(scan.frame.url, [box], products)
        .then((res) => res[0] ?? ({ state: "error" } as TargetIdentity))
        .catch((): TargetIdentity => ({ state: "error" }));
      cache.entries.set(key, pending);
    }
  }
}

/** The counter frame the pointings were resolved against, shown to the user for review. */
export type Evidence = { frameUrl: string; width: number; height: number };

/** One pointing at a product: what it was, where it is in the frame and how long the finger stayed on it. */
export type PointedMark = {
  target: PointedTarget;
  name: string | null;
  box: Box | null;
  duration: number;
  evidence?: Evidence;
};

export type Located = {
  marks: PointedMark[];
  objectCount: number;
  handSeen: boolean;
  evidence: Evidence | null;
  extraEvidence?: Evidence[];
};

const KEYFRAME_WINDOW_MS = 400;
const KEYFRAME_BOX_RADIUS = 0.14;

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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function boxAroundTip(tip: Point): Box {
  return {
    x1: clamp01(tip.x - KEYFRAME_BOX_RADIUS),
    y1: clamp01(tip.y - KEYFRAME_BOX_RADIUS),
    x2: clamp01(tip.x + KEYFRAME_BOX_RADIUS),
    y2: clamp01(tip.y + KEYFRAME_BOX_RADIUS),
  };
}

/** Finds the sharpest keyframe captured during or right next to a pointing visit. */
export function keyframeForVisit(visit: Visit, keyframes: Keyframe[]): Keyframe | null {
  if (keyframes.length === 0) return null;
  const inWindow = keyframes.filter(
    (kf) => kf.at >= visit.start - KEYFRAME_WINDOW_MS && kf.at <= visit.end + KEYFRAME_WINDOW_MS,
  );
  if (inWindow.length === 0) return null;

  const bestFrame = pickBestFrame(inWindow.map((kf) => kf.frame));
  return inWindow.find((kf) => kf.frame === bestFrame) ?? inWindow[0];
}

/**
 * Runs an immediate scan at press, retries once if the first scan fails, and falls back to the
 * newest successful scan so a quick user always gets a counter photo.
 */
export async function scanWithFallback(
  captureFrameFn: () => Frame | null,
  requestScanFn: (frameUrl: string) => Promise<ScanResult>,
  fallbackScan: Scan | null,
  onSuccess?: (scan: Scan) => void,
): Promise<Scan | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const frame = captureFrameFn();
    if (!frame) break;
    try {
      const result = await requestScanFn(frame.url);
      if (result.status === "OK") {
        const scan: Scan = { result, frame };
        onSuccess?.(scan);
        return scan;
      }
    } catch {
      // Proceed to retry or fallback.
    }
  }
  return fallbackScan;
}

// Resolves the fingertip trace to the products pointed at, in order, then to catalogue products.
export async function locateTargets(
  scan: Promise<Scan | null> | null,
  samples: TraceSample[],
  products: Product[],
  keyframes: Keyframe[] = [],
  identifyFn: typeof identifyTargets = identifyTargets,
  identityCache?: ScanIdentityCache | null,
): Promise<Located> {
  const handSeen = samples.length > 0;
  const failed: Located = { marks: [], objectCount: 0, handSeen, evidence: null };
  if (!scan) return failed;

  try {
    const resolvedScan = await scan;
    if (!resolvedScan || resolvedScan.result.status !== "OK") return failed;
    const { result, frame } = resolvedScan;

    const sorted = [...samples].sort((a, b) => a.at - b.at);
    const cleaned = cleanBoxes(result.boxes);
    const visits = segmentVisits(sorted, cleaned);
    // One identity check per object, even if it was pointed at more than once.
    const boxes = [...new Set(visits.flatMap((visit) => (visit.hit.kind === "box" ? [visit.hit.box] : [])))];

    let identities: TargetIdentity[] = [];
    if (boxes.length > 0) {
      const activeCache = identityCache?.frameUrl === frame.url ? identityCache : null;
      if (activeCache) {
        const missing = boxes.filter((box) => !activeCache.entries.has(boxCacheKey(box)));
        if (missing.length > 0) {
          const batchPromise = identifyFn(frame.url, missing, products);
          missing.forEach((box, idx) => {
            activeCache.entries.set(
              boxCacheKey(box),
              batchPromise
                .then((res) => res[idx] ?? ({ state: "error" } as TargetIdentity))
                .catch((): TargetIdentity => ({ state: "error" })),
            );
          });
        }
        identities = await Promise.all(
          boxes.map((box) => activeCache.entries.get(boxCacheKey(box)) ?? Promise.resolve({ state: "error" as const })),
        );
      } else {
        identities = await identifyFn(frame.url, boxes, products);
      }
    }

    const primaryEvidence: Evidence = { frameUrl: frame.url, width: frame.width, height: frame.height };
    const extraEvidenceMap = new Map<string, Evidence>();

    const marks: PointedMark[] = [];
    for (const visit of visits) {
      const duration = visit.end - visit.start;
      const kf = keyframeForVisit(visit, keyframes);

      if (visit.hit.kind === "none") {
        // If the fingertip paused on a spot where SAM detected no box, check the crop around the fingertip
        // so the vision model sees whether that spot is empty counter space or contains an object.
        const inspectFrame = kf ? kf.frame : frame;
        const inspectTip = kf ? kf.tip : visit.tip;
        const emptyCheckBox = boxAroundTip(inspectTip);
        if (products.length > 0) {
          const [spotIdentity] = await identifyFn(inspectFrame.url, [emptyCheckBox], products);
          if (spotIdentity?.state === "product") {
            const spotEvidence: Evidence = {
              frameUrl: inspectFrame.url,
              width: inspectFrame.width,
              height: inspectFrame.height,
            };
            if (inspectFrame.url !== frame.url) {
              extraEvidenceMap.set(inspectFrame.url, spotEvidence);
            }
            marks.push({
              target: fromIdentity(spotIdentity),
              name: spotIdentity.name,
              box: emptyCheckBox,
              duration,
              evidence: spotEvidence,
            });
            continue;
          }
        }
        marks.push({ target: { state: "none" }, name: null, box: null, duration });
        continue;
      }

      if (visit.hit.kind === "ambiguous") {
        marks.push({ target: { state: "ambiguous" }, name: null, box: null, duration });
        continue;
      }

      let identity = identities[boxes.indexOf(visit.hit.box)];
      let markBox: Box = visit.hit.box;
      let markEvidence: Evidence = primaryEvidence;

      // If the camera moved during the hold so the initial scan could not identify the product,
      // check the keyframe captured at that pointing visit.
      if ((!identity || identity.state !== "product") && kf && kf.frame.url !== frame.url && products.length > 0) {
        const kfBox = boxAroundTip(kf.tip);
        const [kfIdentity] = await identifyFn(kf.frame.url, [kfBox], products);
        if (kfIdentity?.state === "product") {
          identity = kfIdentity;
          markBox = kfBox;
          markEvidence = { frameUrl: kf.frame.url, width: kf.frame.width, height: kf.frame.height };
          extraEvidenceMap.set(kf.frame.url, markEvidence);
        }
      }

      marks.push({
        target: fromIdentity(identity),
        name: identity?.state === "product" ? identity.name : null,
        box: markBox,
        duration,
        evidence: markEvidence,
      });
    }

    const extraEvidence = [...extraEvidenceMap.values()];
    return {
      marks,
      objectCount: result.boxes.length,
      handSeen,
      evidence: primaryEvidence,
      ...(extraEvidence.length > 0 ? { extraEvidence } : {}),
    };
  } catch {
    return failed;
  }
}

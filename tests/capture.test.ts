import { describe, expect, it } from "vitest";
import type { Product } from "../lib/catalogue/types";
import { pickBestFrame, scoreFrameQuality } from "../lib/media/capture";
import { keyframeForVisit, locateTargets, scanWithFallback, type Scan } from "../lib/pointing/locate";
import type { Keyframe } from "../lib/pointing/use-pointing-session";

function syntheticRgba(width: number, height: number, fill: (x: number, y: number) => number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = Math.max(0, Math.min(255, Math.round(fill(x, y))));
      const i = (y * width + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
}

describe("scoreFrameQuality and pickBestFrame", () => {
  it("scores a sharp, well-exposed frame higher than a blurry or dark frame", () => {
    const sharpWellExposed = syntheticRgba(16, 16, (x, y) => ((x + y) % 2 === 0 ? 180 : 80));
    const blurryMid = syntheticRgba(16, 16, (x) => 120 + (x % 2) * 4);
    const darkShadowed = syntheticRgba(16, 16, (x, y) => ((x + y) % 2 === 0 ? 25 : 10));

    const qSharp = scoreFrameQuality(sharpWellExposed, 16, 16);
    const qBlurry = scoreFrameQuality(blurryMid, 16, 16);
    const qDark = scoreFrameQuality(darkShadowed, 16, 16);

    expect(qSharp.score).toBeGreaterThan(qBlurry.score);
    expect(qSharp.score).toBeGreaterThan(qDark.score);

    const best = pickBestFrame([
      { url: "data:image/jpeg;base64,dark", width: 16, height: 16, score: qDark.score },
      { url: "data:image/jpeg;base64,sharp", width: 16, height: 16, score: qSharp.score },
      { url: "data:image/jpeg;base64,blurry", width: 16, height: 16, score: qBlurry.score },
    ]);
    expect(best?.url).toBe("data:image/jpeg;base64,sharp");
  });
});

describe("scanWithFallback", () => {
  const frame = { url: "data:image/jpeg;base64,live", width: 640, height: 480, score: 10 };
  const fallback: Scan = {
    result: { status: "OK", boxes: [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }], latencyMs: 10 },
    frame: { url: "data:image/jpeg;base64,cached", width: 640, height: 480, score: 8 },
  };

  it("retries once when the first scan fails and succeeds on the second attempt", async () => {
    let attempts = 0;
    const scan = await scanWithFallback(
      () => frame,
      async () => {
        attempts += 1;
        if (attempts === 1) return { status: "ERROR", latencyMs: 5 };
        return { status: "OK", boxes: [{ x1: 0.2, y1: 0.2, x2: 0.4, y2: 0.4 }], latencyMs: 12 };
      },
      fallback,
    );

    expect(attempts).toBe(2);
    expect(scan?.frame.url).toBe(frame.url);
  });

  it("falls back to the newest successful scan when both attempts fail", async () => {
    const scan = await scanWithFallback(
      () => frame,
      async () => ({ status: "ERROR", latencyMs: 5 }),
      fallback,
    );

    expect(scan).toEqual(fallback);
  });
});

describe("keyframeForVisit and locateTargets with visit keyframes", () => {
  const product: Product = {
    id: "p1",
    sku: "KIK1",
    name: "Kikombe",
    price: 1000,
    currency: "TZS",
    aliases: [],
    referenceImages: ["data:image/jpeg;base64,ref"],
    active: true,
  };

  it("identifies a product from a visit keyframe when the camera moved during the hold and records both photos", async () => {
    const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 };
    const initialScan: Scan = {
      result: { status: "OK", boxes: [box], latencyMs: 10 },
      frame: { url: "data:image/jpeg;base64,initial", width: 640, height: 480, score: 5 },
    };

    const samples = [
      { tip: { x: 0.2, y: 0.2 }, direction: { x: 0, y: -1 }, hand: { x1: 0.1, y1: 0.5, x2: 0.3, y2: 0.8 }, at: 100 },
      { tip: { x: 0.2, y: 0.2 }, direction: { x: 0, y: -1 }, hand: { x1: 0.1, y1: 0.5, x2: 0.3, y2: 0.8 }, at: 250 },
      { tip: { x: 0.2, y: 0.2 }, direction: { x: 0, y: -1 }, hand: { x1: 0.1, y1: 0.5, x2: 0.3, y2: 0.8 }, at: 450 },
    ];

    const keyframes: Keyframe[] = [
      {
        at: 300,
        tip: { x: 0.2, y: 0.2 },
        frame: { url: "data:image/jpeg;base64,visit-kf", width: 640, height: 480, score: 12 },
      },
    ];

    const bestKf = keyframeForVisit({ hit: { kind: "box", box }, tip: { x: 0.2, y: 0.2 }, start: 100, end: 500 }, keyframes);
    expect(bestKf?.frame.url).toBe("data:image/jpeg;base64,visit-kf");

    const located = await locateTargets(
      Promise.resolve(initialScan),
      samples,
      [product],
      keyframes,
      async (frameUrl) => {
        if (frameUrl === "data:image/jpeg;base64,initial") {
          return [{ state: "unknown" }];
        }
        return [{ state: "product", sku: "KIK1", name: "Kikombe" }];
      },
    );

    expect(located.marks).toHaveLength(1);
    expect(located.marks[0].target).toEqual({ state: "product", sku: "KIK1" });
    expect(located.evidence?.frameUrl).toBe("data:image/jpeg;base64,initial");
    expect(located.extraEvidence?.map((e) => e.frameUrl)).toEqual(["data:image/jpeg;base64,visit-kf"]);
  });
});

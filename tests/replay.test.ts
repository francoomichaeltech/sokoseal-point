import { describe, expect, it } from "vitest";
import { evaluateHolds, replayHold } from "../scripts/replay.mjs";

describe("deterministic replay evaluation", () => {
  const sampleProducts = [
    {
      id: "prod-1",
      sku: "COKE1",
      name: "Coca-Cola 350ml",
      price: 1000,
      currency: "TZS" as const,
      aliases: ["Coke", "Soda"],
      referenceImages: [],
      active: true,
    },
    {
      id: "prod-2",
      sku: "PEPSI1",
      name: "Pepsi 350ml",
      price: 1000,
      currency: "TZS" as const,
      aliases: ["Pepsi"],
      referenceImages: [],
      active: true,
    },
  ];

  const sampleBoxes = [
    { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.4 },
    { x1: 0.5, y1: 0.1, x2: 0.7, y2: 0.4 },
  ];

  it("handles empty hold list gracefully", () => {
    const result = evaluateHolds([]);
    expect(result.totalHolds).toBe(0);
    expect(result.pointingAccuracy).toBeNull();
    expect(result.actionAccuracy).toBeNull();
    expect(result.chooseProductRate).toBe(0);
  });

  it("replays a one-product hold and verifies pointing accuracy", () => {
    const hold = {
      id: "test-hold-1",
      createdAt: 10000,
      holdStartMs: 0,
      holdEndMs: 2000,
      durationMs: 2000,
      frameUrl: "data:image/jpeg;base64,fake",
      frameWidth: 1280,
      frameHeight: 720,
      samBoxes: sampleBoxes,
      // 10 samples aiming into the first box from below over 450ms
      samples: Array.from({ length: 10 }, (_, i) => ({
        tip: { x: 0.2, y: 0.3 },
        direction: { x: 0, y: -1 },
        hand: { x1: 0.15, y1: 0.5, x2: 0.25, y2: 0.8 },
        at: 1000 + i * 50,
      })),
      identities: [
        {
          box: sampleBoxes[0],
          state: "product",
          sku: "COKE1",
          name: "Coca-Cola 350ml",
        },
      ],
      transcript: "Nipe hii mbili",
      heard: "Nipe hii mbili",
      intent: {
        transcript: "Nipe hii mbili",
        actions: [
          {
            action: "ADD" as const,
            quantity: 2,
            reference: "POINT" as const,
            namedProduct: null,
            spoken: "Nipe hii mbili",
          },
        ],
        needsClarification: false,
      },
      pairedTargets: [{ state: "product" as const, sku: "COKE1" }],
      marks: [],
      outcomes: [],
      products: sampleProducts,
      latencies: {
        scanMs: 1200,
        transcribeMs: 800,
        identifyMs: 1500,
        intentMs: 1100,
        totalMs: 3200,
      },
      annotation: {
        status: "correct" as const,
        meantProducts: ["COKE1"],
        annotatedAt: 12000,
      },
    };

    const replayed = replayHold(hold);
    expect(replayed.marks.length).toBe(1);
    expect(replayed.targets[0]).toEqual({ state: "product", sku: "COKE1" });
    expect(replayed.outcomes[0].status).toBe("applied");

    const evalResult = evaluateHolds([hold]);
    expect(evalResult.totalHolds).toBe(1);
    expect(evalResult.totalPointed).toBe(1);
    expect(evalResult.correctPointed).toBe(1);
    expect(evalResult.pointingAccuracy).toBe(100);
    expect(evalResult.chooseProductCount).toBe(0);
    expect(evalResult.latencies.totalMedian).toBe(3200);
  });

  it("correctly evaluates empty space ground truth", () => {
    const hold = {
      id: "test-hold-empty",
      createdAt: 20000,
      holdStartMs: 0,
      holdEndMs: 2000,
      durationMs: 2000,
      frameUrl: "data:image/jpeg;base64,fake",
      frameWidth: 1280,
      frameHeight: 720,
      samBoxes: sampleBoxes,
      // Finger pointing at (0.9, 0.9) - far away from any box
      samples: Array.from({ length: 10 }, (_, i) => ({
        tip: { x: 0.9, y: 0.9 },
        direction: { x: 0, y: 1 },
        hand: { x1: 0.85, y1: 0.85, x2: 0.95, y2: 0.95 },
        at: 1000 + i * 50,
      })),
      identities: [],
      transcript: "Nipe hii",
      heard: "Nipe hii",
      intent: {
        transcript: "Nipe hii",
        actions: [
          {
            action: "ADD" as const,
            quantity: 1,
            reference: "POINT" as const,
            namedProduct: null,
            spoken: "Nipe hii",
          },
        ],
        needsClarification: false,
      },
      pairedTargets: [],
      marks: [],
      outcomes: [],
      products: sampleProducts,
      annotation: {
        status: "wrong" as const,
        meantProducts: ["nothing" as const],
        annotatedAt: 22000,
      },
    };

    const replayed = replayHold(hold);
    // Out in empty space: no visit found
    expect(replayed.targets.length).toBe(0);
    // Outcome should be rejected with nothing_pointed
    expect(replayed.outcomes[0].status).toBe("rejected");

    const evalResult = evaluateHolds([hold]);
    expect(evalResult.totalEmpty).toBe(1);
    expect(evalResult.correctEmpty).toBe(1);
    expect(evalResult.emptySpaceAccuracy).toBe(100);
  });
});

import { describe, expect, it } from "vitest";
import { parseBoxes } from "../lib/grounding/parse";
import { cleanBoxes, selectTarget } from "../lib/grounding/select";

// Output from spike 01 on scene-all.jpg with the concept "object" (mask data elided).
const SCENE_ALL =
  "<0f>0<|box;x1=503;y1=298;x2=1173;y2=594;w=1280;h=963|><|mask;x=0;y=0;data=…|>," +
  "1<|box;x1=169;y1=596;x2=662;y2=725;w=1280;h=963|><|mask;x=0;y=0;data=…|>," +
  "2<|box;x1=57;y1=153;x2=492;y2=528;w=1280;h=963|><|mask;x=0;y=0;data=…|>";

const boxes = parseBoxes(SCENE_ALL);
const mug = boxes[2];

describe("parseBoxes", () => {
  it("reads every record and normalizes it to the frame", () => {
    expect(boxes).toHaveLength(3);
    expect(mug.x1).toBeCloseTo(57 / 1280);
    expect(mug.y2).toBeCloseTo(528 / 963);
  });

  it("returns nothing for empty output", () => {
    expect(parseBoxes("")).toEqual([]);
  });
});

describe("selectTarget", () => {
  it("matches the object under the tap", () => {
    expect(selectTarget(boxes, { x: 0.2, y: 0.35 })).toEqual({ status: "MATCH", box: mug });
  });

  it("returns NONE for a tap on the empty table", () => {
    expect(selectTarget(boxes, { x: 0.95, y: 0.05 })).toEqual({ status: "NONE" });
  });

  it("is ambiguous in the gap between the mug and the strainer", () => {
    expect(selectTarget(boxes, { x: 0.388, y: 0.4 }).status).toBe("AMBIGUOUS");
  });

  it("prefers a much smaller box nested inside a larger one", () => {
    const outer = { x1: 0, y1: 0, x2: 1, y2: 1 };
    const inner = { x1: 0.4, y1: 0.4, x2: 0.5, y2: 0.5 };
    expect(selectTarget([outer, inner], { x: 0.45, y: 0.45 })).toEqual({ status: "MATCH", box: inner });
  });

  it("returns NONE when nothing was detected", () => {
    expect(selectTarget([], { x: 0.5, y: 0.5 })).toEqual({ status: "NONE" });
  });
});

describe("cleanBoxes", () => {
  it("drops frame-covering table/shadow boxes and tiny noise and merges near-duplicates", () => {
    const tableBox = { x1: 0.01, y1: 0.02, x2: 0.99, y2: 0.98 };
    const tinyNoise = { x1: 0.5, y1: 0.5, x2: 0.505, y2: 0.505 };
    const validA = { x1: 0.2, y1: 0.2, x2: 0.4, y2: 0.4 };
    const duplicateA = { x1: 0.205, y1: 0.205, x2: 0.405, y2: 0.405 };
    const validB = { x1: 0.6, y1: 0.3, x2: 0.75, y2: 0.5 };

    const cleaned = cleanBoxes([tableBox, tinyNoise, validA, duplicateA, validB]);
    expect(cleaned).toHaveLength(2);
    expect(cleaned[0]).toEqual({ x1: 0.2, y1: 0.2, x2: 0.405, y2: 0.405 });
    expect(cleaned[1]).toEqual(validB);
  });
});
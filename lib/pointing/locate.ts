import type { Product } from "@/lib/catalogue/types";
import { toPointedTargets } from "@/lib/commerce/targets";
import type { PointedTarget } from "@/lib/commerce/types";
import type { ScanResult } from "@/lib/grounding/types";
import { identifyTargets } from "@/lib/identity/identify-targets";
import type { Frame } from "@/lib/media/capture";
import type { Dwell } from "./dwell";
import { resolveDwell } from "./resolve";

export type Scan = { result: ScanResult; frame: Frame };
export type Located = { targets: PointedTarget[]; objectCount: number };

// Resolves each finger pause to an object on the scanned counter, then to a catalogue product.
export async function locateTargets(scan: Promise<Scan> | null, dwells: Dwell[], products: Product[]): Promise<Located> {
  const failed: Located = { targets: dwells.map((): PointedTarget => ({ state: "error" })), objectCount: 0 };
  if (!scan) return failed;

  try {
    const { result, frame } = await scan;
    if (result.status !== "OK") return failed;

    const selections = dwells.map((dwell) => resolveDwell(result.boxes, dwell));
    // One identity check per object, even if it was pointed at more than once.
    const boxes = [...new Set(selections.flatMap((selection) => (selection.status === "MATCH" ? [selection.box] : [])))];
    const identities = boxes.length > 0 ? await identifyTargets(frame.url, boxes, products) : [];
    const labels = selections.map((selection) =>
      selection.status === "MATCH" ? (identities[boxes.indexOf(selection.box)] ?? null) : null,
    );

    return { targets: toPointedTargets(selections, labels), objectCount: result.boxes.length };
  } catch {
    return failed;
  }
}
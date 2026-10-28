import type { Selection } from "@/lib/grounding/types";
import type { TargetIdentity } from "@/lib/identity/types";
import type { PointedTarget } from "./types";

// One result per finger pause. An identity that never finished counts as a failed check.
export function toPointedTargets(selections: Selection[], labels: (TargetIdentity | null)[]): PointedTarget[] {
  return selections.map((selection, index): PointedTarget => {
    if (selection.status === "NONE") return { state: "none" };
    if (selection.status === "AMBIGUOUS") return { state: "ambiguous" };

    const label = labels[index];
    switch (label?.state) {
      case "product":
        return { state: "product", sku: label.sku };
      case "unknown":
        return { state: "unknown" };
      case "ambiguous":
        return { state: "ambiguous" };
      default:
        return { state: "error" };
    }
  });
}
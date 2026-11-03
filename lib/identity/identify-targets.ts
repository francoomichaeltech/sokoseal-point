import { referenceProducts } from "@/lib/catalogue/references";
import type { Product } from "@/lib/catalogue/types";
import type { Box } from "@/lib/grounding/types";
import { cropBox, loadImage } from "@/lib/media/image";
import { requestIdentity } from "./client";
import { AMBIGUOUS, UNKNOWN, type TargetIdentity } from "./types";

const CROP_EDGE = 384;

// Crops each pointed object from the scanned frame and asks which catalogue product it is.
export async function identifyTargets(frameUrl: string, boxes: Box[], products: Product[]): Promise<TargetIdentity[]> {
  const failed = boxes.map((): TargetIdentity => ({ state: "error" }));

  try {
    const [image, references] = await Promise.all([loadImage(frameUrl), referenceProducts(products)]);
    const crops = boxes.map((box) => cropBox(image, box, CROP_EDGE));
    if (!crops.every((crop): crop is string => crop !== null)) return failed;

    const result = await requestIdentity(crops, references);
    if (result.status !== "OK" || result.matches.length !== boxes.length) return failed;

    const names = new Map(references.map((reference) => [reference.sku, reference.name]));
    return result.matches.map((match): TargetIdentity => {
      if (match === UNKNOWN) return { state: "unknown" };
      if (match === AMBIGUOUS) return { state: "ambiguous" };
      const name = names.get(match);
      return name ? { state: "product", sku: match, name } : { state: "error" };
    });
  } catch {
    return failed;
  }
}
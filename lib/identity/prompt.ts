import type { SparkContent } from "@/lib/meta/spark";
import { AMBIGUOUS, targetKey, UNKNOWN, type ReferenceProduct } from "./types";

const INSTRUCTIONS = `You identify products at a shop counter.

The first images are reference photos of the products this shop sells, each labelled with its SKU and name. The images after them are crops of objects a customer pointed at, labelled T1, T2 and so on.

For each crop, return the SKU of the product it shows.
- Match only when the crop clearly shows the same product as a reference photo: same kind of item, shape and colour. Lighting, angle and background may differ.
- Return "${UNKNOWN}" when the object is not one of the reference products, or the crop does not show a product.
- Return "${AMBIGUOUS}" when it could be two or more of the reference products and you cannot tell which.
- Never guess. A wrong product is worse than "${UNKNOWN}".`;

export function identityContent(targets: string[], products: ReferenceProduct[]): SparkContent[] {
  const content: SparkContent[] = [{ type: "input_text", text: INSTRUCTIONS }];

  for (const product of products) {
    // Names are JSON-quoted so merchant text cannot break out of the label.
    content.push({ type: "input_text", text: `Reference ${product.sku} ${JSON.stringify(product.name)}:` });
    content.push({ type: "input_image", image_url: product.image });
  }

  targets.forEach((image, index) => {
    content.push({ type: "input_text", text: `Crop ${targetKey(index)}:` });
    content.push({ type: "input_image", image_url: image });
  });

  content.push({ type: "input_text", text: `Answer for ${targets.map((_, index) => targetKey(index)).join(", ")}.` });
  return content;
}

// One required key per crop, each limited to the shop's SKUs, so the model cannot invent a product.
export function identitySchema(skus: string[], count: number) {
  const result = { type: "string", enum: [...skus, UNKNOWN, AMBIGUOUS] };
  const keys = Array.from({ length: count }, (_, index) => targetKey(index));

  return {
    type: "object",
    additionalProperties: false,
    required: keys,
    properties: Object.fromEntries(keys.map((key) => [key, result])),
  };
}
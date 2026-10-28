import type { SparkContent } from "@/lib/meta/spark";
import { AMBIGUOUS, targetKey, UNKNOWN, type ReferenceProduct } from "./types";

const INSTRUCTIONS = `You identify products at a shop counter.

Some of the images are reference photos of the products this shop sells. The others are crops of objects a customer pointed at. The list below gives every image in order and says which is which.

For each crop, return the SKU of the product it shows.
- Match only when the crop clearly shows the same product as a reference photo: same kind of item, shape and colour. Lighting, angle and background may differ.
- Return "${UNKNOWN}" when the object is not one of the reference products, or the crop does not show a product.
- Return "${AMBIGUOUS}" when it could be two or more of the reference products and you cannot tell which.
- Never guess. A wrong product is worse than "${UNKNOWN}".`;

// One text part followed by the images, the request shape verified by scripts/identify-spike.mjs.
export function identityContent(targets: string[], products: ReferenceProduct[]): SparkContent[] {
  // Names are JSON-quoted so merchant text cannot break out of the list.
  const references = products.map(
    (product, index) => `Image ${index + 1}: reference ${product.sku} ${JSON.stringify(product.name)}`,
  );
  const crops = targets.map((_, index) => `Image ${products.length + index + 1}: crop ${targetKey(index)}`);
  const keys = targets.map((_, index) => targetKey(index)).join(", ");

  const text = [INSTRUCTIONS, "", "Images in order:", ...references, ...crops, "", `Answer for ${keys}.`].join("\n");
  const images = [...products.map((product) => product.image), ...targets];

  return [
    { type: "input_text", text },
    ...images.map((url): SparkContent => ({ type: "input_image", image_url: url })),
  ];
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
import type { SparkContent } from "@/lib/meta/spark";
import { AMBIGUOUS, targetKey, UNKNOWN, type ReferenceProduct } from "./types";

const INSTRUCTIONS = `You identify products at a shop counter.

Some of the images are reference photos of the products this shop sells; a product may have several. The others are crops of objects a customer pointed at. The list below gives every image in order and says which is which.

For each crop, return the SKU of the product it shows.
- Match when the crop shows the same product as a reference: the same kind of item, and the same brand, label, shape and colour where they are visible. A different angle, lighting, background or distance, or a hand partly covering it, does not make it a different product.

- Return "${UNKNOWN}" when the object is clearly not any reference product, or the crop shows no product.

- Return "${AMBIGUOUS}" when it could be two or more reference products, for example two drinks in similar bottles whose labels you cannot read.

- Do not guess between products. If you cannot tell, use "${AMBIGUOUS}" or "${UNKNOWN}".`;

// One text part followed by the images, the request shape verified by scripts/identify-spike.mjs.
export function identityContent(targets: string[], products: ReferenceProduct[]): SparkContent[] {
  const lines: string[] = [];
  const images: string[] = [];

  for (const product of products) {
    // Merchant text is JSON-quoted so it cannot break out of the list.
    const hint = product.hint ? ` ${JSON.stringify(product.hint)}` : "";
    for (const image of product.images) {
      images.push(image);
      lines.push(`Image ${images.length}: reference ${product.sku} ${JSON.stringify(product.name)}${hint}`);
    }
  }
  targets.forEach((image, index) => {
    images.push(image);
    lines.push(`Image ${images.length}: crop ${targetKey(index)}`);
  });

  const keys = targets.map((_, index) => targetKey(index)).join(", ");
  const text = [INSTRUCTIONS, "", "Images in order:", ...lines, "", `Answer for ${keys}.`].join("\n");

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
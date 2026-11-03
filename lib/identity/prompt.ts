import type { SparkContent } from "@/lib/meta/spark";
import { AMBIGUOUS, targetKey, UNKNOWN, type ReferenceProduct } from "./types";

const INSTRUCTIONS = `You identify products at a shop counter.

Some of the images are reference photos of the products this shop sells; a product may have several. When a scene image is included, it shows the full counter so you can see all objects in context, their relative sizes and positions. The crop images show the exact objects a customer pointed at. The list below gives every image in order and says which is which.

For each crop, return the SKU of the product it shows.
- Match ONLY when the crop shows the exact same product as a reference: the same object type, category, material, shape, colour, packaging and label where visible. A different angle, lighting, background or distance, or a hand partly covering it, does not make it a different product.

- Return "${UNKNOWN}" when the pointed object is not in the shop's reference products (for example electronics, a charger adapter, a computer mouse, a phone, keys, a hand, the table, or a different brand, container or item not shown in any reference photo), or when the crop shows no product. Never guess or pick the closest shop product just because it is in the catalogue.

- Return "${AMBIGUOUS}" when it could be two or more reference products, for example two drinks in similar bottles whose labels you cannot read.

- Do not guess between products. If you cannot tell, use "${AMBIGUOUS}" or "${UNKNOWN}".`;

// One text part followed by the images, the request shape verified by scripts/identify-spike.mjs.
export function identityContent(
  targets: string[],
  products: ReferenceProduct[],
  scene?: string | null,
): SparkContent[] {
  const lines: string[] = [];
  const images: string[] = [];

  for (const product of products) {
    // Merchant text is JSON-quoted so it cannot break out of the list.
    const hint = product.hint ? ` ${JSON.stringify(product.hint)}` : "";
    for (const image of product.images) {
      images.push(image);
      lines.push(`Image ${images.length}: reference ${JSON.stringify(product.sku)} ${JSON.stringify(product.name)}${hint}`);
    }
  }
  if (scene) {
    images.push(scene);
    lines.push(`Image ${images.length}: full counter scene (context showing all objects on the counter)`);
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
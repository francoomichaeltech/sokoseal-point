import { isSameOrigin } from "@/lib/http/same-origin";
import { isReservedSku } from "@/lib/catalogue/sku";
import { identify } from "@/lib/identity/adapter";
import type { ReferenceProduct } from "@/lib/identity/types";

const JPEG_PREFIX = "data:image/jpeg;base64,";
// Crops are at most 512 px and references 320 px on the long edge.
const MAX_IMAGE_CHARS = 300_000;
const MAX_TARGETS = 20;
const MAX_PRODUCTS = 10;
const MAX_IMAGES_PER_PRODUCT = 3;
const MAX_NAME_LENGTH = 60;
const MAX_HINT_LENGTH = 120;
const MAX_SKU_LENGTH = 30;

function isImage(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(JPEG_PREFIX) && value.length <= MAX_IMAGE_CHARS;
}

function parseTargets(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const targets = value.filter(isImage);
  return targets.length > 0 && targets.length === value.length && targets.length <= MAX_TARGETS ? targets : null;
}

function parseProducts(value: unknown): ReferenceProduct[] | null {
  if (!Array.isArray(value) || value.length > MAX_PRODUCTS) return null;

  const seen = new Set<string>();
  const products: ReferenceProduct[] = [];

  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const { sku, name, hint, images } = item as Record<string, unknown>;

    if (
      typeof sku !== "string" ||
      !sku.trim() ||
      sku.length > MAX_SKU_LENGTH ||
      isReservedSku(sku) ||
      seen.has(sku)
    ) {
      return null;
    }
    if (typeof name !== "string" || !name.trim() || name.length > MAX_NAME_LENGTH) return null;
    if (hint !== undefined && (typeof hint !== "string" || hint.length > MAX_HINT_LENGTH)) return null;

    const photos = Array.isArray(images) ? images.filter(isImage) : [];
    if (
      !Array.isArray(images) ||
      photos.length === 0 ||
      photos.length !== images.length ||
      photos.length > MAX_IMAGES_PER_PRODUCT
    ) {
      return null;
    }

    seen.add(sku);
    const cleanHint = typeof hint === "string" && hint.trim() ? hint.trim() : undefined;
    products.push({ sku, name: name.trim(), hint: cleanHint, images: photos });
  }

  return products;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let fields: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    fields = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const targets = parseTargets(fields.targets);
  const products = parseProducts(fields.products);
  if (!targets || !products) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  return Response.json(await identify(targets, products));
}
import type { ReferenceProduct } from "@/lib/identity/types";
import { drawToJpeg } from "@/lib/media/image";
import { loadPhoto } from "./photos";
import type { Product } from "./types";

const REFERENCE_EDGE = 320;
const MAX_REFERENCES = 10;
// Several angles help tell apart products that look alike, such as two drinks in similar bottles.
const PHOTOS_PER_PRODUCT = 3;

// Photo IDs never change content (a replaced photo gets a new ID), so results are cached per ID.
const cache = new Map<string, Promise<string | null>>();

function referenceImage(photoId: string): Promise<string | null> {
  let pending = cache.get(photoId);

  if (!pending) {
    pending = loadPhoto(photoId)
      .then(async (blob) => {
        if (!blob) return null;
        const bitmap = await createImageBitmap(blob);
        try {
          return drawToJpeg(bitmap, { x: 0, y: 0, width: bitmap.width, height: bitmap.height }, REFERENCE_EDGE);
        } finally {
          bitmap.close();
        }
      })
      .catch(() => null);
    cache.set(photoId, pending);
  }

  return pending;
}

/** Up to three reference photos of each active product, small enough to send with every request. */
export async function referenceProducts(products: Product[]): Promise<ReferenceProduct[]> {
  const active = products
    .filter((product) => product.active && product.referenceImages.length > 0)
    .slice(0, MAX_REFERENCES);
  const photos = await Promise.all(
    active.map((product) => Promise.all(product.referenceImages.slice(0, PHOTOS_PER_PRODUCT).map(referenceImage))),
  );

  return active.flatMap((product, index) => {
    const images = photos[index].filter((image): image is string => image !== null);
    return images.length > 0
      ? [{ sku: product.sku, name: product.name, hint: product.visualHint, images }]
      : [];
  });
}
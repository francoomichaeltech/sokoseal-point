import type { ReferenceProduct } from "@/lib/identity/types";
import { drawToJpeg } from "@/lib/media/image";
import { loadPhoto } from "./photos";
import type { Product } from "./types";

const REFERENCE_EDGE = 256;
const MAX_REFERENCES = 12;

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

/** The first reference photo of each active product, small enough to send with every request. */
export async function referenceProducts(products: Product[]): Promise<ReferenceProduct[]> {
  const active = products
    .filter((product) => product.active && product.referenceImages.length > 0)
    .slice(0, MAX_REFERENCES);
  const images = await Promise.all(active.map((product) => referenceImage(product.referenceImages[0])));

  return active.flatMap((product, index) => {
    const image = images[index];
    return image ? [{ sku: product.sku, name: product.name, image }] : [];
  });
}
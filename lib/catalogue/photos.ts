import { delMany, get, set } from "idb-keyval";

const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.85;

const photoKey = (id: string) => `photo:${id}`;

// Downscales before storing to keep IndexedDB small and later model uploads fast.
export async function preparePhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is not available");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode photo"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

export function savePhoto(id: string, blob: Blob) {
  return set(photoKey(id), blob);
}

export function loadPhoto(id: string) {
  return get<Blob>(photoKey(id));
}

export function deletePhotos(ids: string[]) {
  return delMany(ids.map(photoKey));
}
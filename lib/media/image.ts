import type { Box } from "@/lib/grounding/types";

type Region = { x: number; y: number; width: number; height: number };

// Margin around the box so the whole product is in the crop even when the box is tight.
const CROP_PADDING = 0.1;

/** Draws a region of an image into a JPEG data URL whose long edge is at most maxEdge. */
export function drawToJpeg(source: CanvasImageSource, region: Region, maxEdge: number, quality = 0.85): string | null {
  const scale = Math.min(1, maxEdge / Math.max(region.width, region.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(region.width * scale));
  canvas.height = Math.max(1, Math.round(region.height * scale));

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(source, region.x, region.y, region.width, region.height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

export function cropBox(image: HTMLImageElement, box: Box, maxEdge: number): string | null {
  const padX = (box.x2 - box.x1) * CROP_PADDING;
  const padY = (box.y2 - box.y1) * CROP_PADDING;
  const x1 = Math.max(0, box.x1 - padX) * image.naturalWidth;
  const y1 = Math.max(0, box.y1 - padY) * image.naturalHeight;
  const x2 = Math.min(1, box.x2 + padX) * image.naturalWidth;
  const y2 = Math.min(1, box.y2 + padY) * image.naturalHeight;
  if (x2 - x1 < 1 || y2 - y1 < 1) return null;

  return drawToJpeg(image, { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }, maxEdge);
}
import type { Box } from "@/lib/grounding/types";

// A tiny grayscale copy of the frame is enough to tell whether the camera or the
// products moved since the last scan.
const WIDTH = 32;
const HEIGHT = 24;
// Hand boxes are grown by this much so fingers at the edge do not count as a scene change.
const IGNORE_MARGIN = 0.05;

export const THUMBNAIL_SIZE = { width: WIDTH, height: HEIGHT };

export type Thumbnail = Uint8Array;

export function createThumbnailer() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  return (video: HTMLVideoElement): Thumbnail | null => {
    if (!context || !video.videoWidth) return null;
    context.drawImage(video, 0, 0, WIDTH, HEIGHT);
    const { data } = context.getImageData(0, 0, WIDTH, HEIGHT);

    const gray = new Uint8Array(WIDTH * HEIGHT);
    for (let i = 0; i < gray.length; i += 1) {
      const offset = i * 4;
      // Integer approximation of Rec. 601 luma.
      gray[i] = (data[offset] * 77 + data[offset + 1] * 150 + data[offset + 2] * 29) >> 8;
    }
    return gray;
  };
}

function isIgnored(x: number, y: number, ignore: Box[]) {
  return ignore.some(
    (box) =>
      x >= box.x1 - IGNORE_MARGIN &&
      x <= box.x2 + IGNORE_MARGIN &&
      y >= box.y1 - IGNORE_MARGIN &&
      y <= box.y2 + IGNORE_MARGIN,
  );
}

/** Mean absolute difference (0..255) over the cells outside the ignored boxes. */
export function sceneDifference(a: Thumbnail, b: Thumbnail, ignore: Box[] = []): number {
  let total = 0;
  let count = 0;

  for (let row = 0; row < HEIGHT; row += 1) {
    for (let col = 0; col < WIDTH; col += 1) {
      if (isIgnored((col + 0.5) / WIDTH, (row + 0.5) / HEIGHT, ignore)) continue;
      const index = row * WIDTH + col;
      total += Math.abs(a[index] - b[index]);
      count += 1;
    }
  }

  return count ? total / count : 0;
}
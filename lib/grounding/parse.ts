import type { Box } from "./types";

// One record per object, coordinates in w x h pixels:
// <|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..|>
const BOX_RECORD = /<\|box;x1=([\d.]+);y1=([\d.]+);x2=([\d.]+);y2=([\d.]+);w=(\d+);h=(\d+)\|>/g;

export function parseBoxes(output: string): Box[] {
  const boxes: Box[] = [];

  for (const match of output.matchAll(BOX_RECORD)) {
    const [x1, y1, x2, y2, width, height] = match.slice(1).map(Number);
    if (!width || !height) continue;
    boxes.push({ x1: x1 / width, y1: y1 / height, x2: x2 / width, y2: y2 / height });
  }

  return boxes;
}
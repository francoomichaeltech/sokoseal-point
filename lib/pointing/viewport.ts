import type { Box, Point } from "@/lib/grounding/types";

type Size = { width: number; height: number };

// The preview uses object-fit: cover, so the frame is scaled up and cropped on one axis.
function coverLayout(view: Size, frame: Size) {
  const scale = Math.max(view.width / frame.width, view.height / frame.height);
  const width = frame.width * scale;
  const height = frame.height * scale;
  return { width, height, left: (view.width - width) / 2, top: (view.height - height) / 2 };
}

/** View pixels to a normalized frame point. Null if the tap falls outside the frame. */
export function viewToFrame(x: number, y: number, view: Size, frame: Size): Point | null {
  const layout = coverLayout(view, frame);
  const point = { x: (x - layout.left) / layout.width, y: (y - layout.top) / layout.height };
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1 ? point : null;
}

export function pointToView(point: Point, view: Size, frame: Size) {
  const layout = coverLayout(view, frame);
  return { left: layout.left + point.x * layout.width, top: layout.top + point.y * layout.height };
}

export function boxToView(box: Box, view: Size, frame: Size) {
  const layout = coverLayout(view, frame);
  return {
    left: layout.left + box.x1 * layout.width,
    top: layout.top + box.y1 * layout.height,
    width: (box.x2 - box.x1) * layout.width,
    height: (box.y2 - box.y1) * layout.height,
  };
}
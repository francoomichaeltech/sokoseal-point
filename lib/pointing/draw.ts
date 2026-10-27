import type { RefObject } from "react";
import type { Box, Point } from "@/lib/grounding/types";
import { boxToView, pointToView } from "./viewport";

export const SPOT_SIZE = 88;
export const RING_RADIUS = 20;
export const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
export const SPOT_GRADIENT =
  "radial-gradient(circle, rgb(255 255 255 / 0.85) 0%, rgb(23 105 224 / 0.45) 35%, rgb(23 105 224 / 0) 70%)";

type Size = { width: number; height: number };

export type PointerFrame = {
  tip: Point;
  spot: Point;
  /** 0..1 progress of the current dwell. */
  progress: number;
  /** Object under the light before it is selected. */
  hover: Box | null;
  frame: Size;
};

export type OverlayRefs = {
  container: RefObject<HTMLDivElement | null>;
  beam: RefObject<HTMLDivElement | null>;
  spot: RefObject<HTMLDivElement | null>;
  ring: RefObject<SVGCircleElement | null>;
  hover: RefObject<HTMLDivElement | null>;
};

// Called on every tracking tick, so it writes styles directly instead of going through React.
export function drawPointer(refs: OverlayRefs, frame: PointerFrame | null) {
  const container = refs.container.current;
  const beam = refs.beam.current;
  const spot = refs.spot.current;
  const ring = refs.ring.current;
  const hover = refs.hover.current;
  if (!container || !beam || !spot || !ring || !hover) return;

  if (!frame) {
    beam.style.opacity = "0";
    spot.style.opacity = "0";
    hover.style.opacity = "0";
    return;
  }

  const view = { width: container.clientWidth, height: container.clientHeight };
  const tip = pointToView(frame.tip, view, frame.frame);
  const target = pointToView(frame.spot, view, frame.frame);
  const dx = target.left - tip.left;
  const dy = target.top - tip.top;

  beam.style.opacity = "1";
  beam.style.width = `${Math.hypot(dx, dy)}px`;
  beam.style.transform = `translate(${tip.left}px, ${tip.top}px) rotate(${Math.atan2(dy, dx)}rad)`;

  spot.style.opacity = "1";
  spot.style.transform = `translate(${target.left - SPOT_SIZE / 2}px, ${target.top - SPOT_SIZE / 2}px)`;
  ring.style.strokeDashoffset = String(RING_LENGTH * (1 - frame.progress));

  if (frame.hover) {
    const box = boxToView(frame.hover, view, frame.frame);
    hover.style.opacity = "1";
    hover.style.transform = `translate(${box.left}px, ${box.top}px)`;
    hover.style.width = `${box.width}px`;
    hover.style.height = `${box.height}px`;
  } else {
    hover.style.opacity = "0";
  }
}
"use client";

import { Check } from "lucide-react";
import type { Box, Point } from "@/lib/grounding/types";
import { useMessages } from "@/lib/i18n/locale";
import type { Evidence, PointedMark } from "@/lib/pointing/locate";
import { useElementSize } from "@/lib/use-element-size";

type Size = { width: number; height: number };

// Keeps each label's centre this far from the card edges so it never leaves the photo.
const LABEL_MARGIN_X = 64;
const LABEL_MARGIN_Y = 14;
const MIN_BOX_PX = 6;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Scales the frame to cover the whole card with no empty bands, centred on the pointed products.
function coverLayout(view: Size, frame: Size, focus: Point) {
  const scale = Math.max(view.width / frame.width, view.height / frame.height);
  const width = frame.width * scale;
  const height = frame.height * scale;
  return {
    width,
    height,
    left: clamp(view.width / 2 - focus.x * width, view.width - width, 0),
    top: clamp(view.height / 2 - focus.y * height, view.height - height, 0),
  };
}

type PointedEvidenceProps = { evidence: Evidence; marks: PointedMark[] };

// The counter as the camera saw it, filling the card, with each pointed product labelled in stock or not.
export function PointedEvidence({ evidence, marks }: PointedEvidenceProps) {
  const t = useMessages();
  const [ref, view] = useElementSize<HTMLDivElement>();

  // Each object once, even if it was pointed at more than once.
  const shown = new Map<Box, PointedMark>();
  for (const mark of marks) if (mark.box && !shown.has(mark.box)) shown.set(mark.box, mark);
  const boxes = [...shown.keys()];

  const focus =
    boxes.length > 0
      ? {
          x: boxes.reduce((sum, box) => sum + (box.x1 + box.x2) / 2, 0) / boxes.length,
          y: boxes.reduce((sum, box) => sum + (box.y1 + box.y2) / 2, 0) / boxes.length,
        }
      : { x: 0.5, y: 0.5 };

  const layout = view.width > 0 && view.height > 0 ? coverLayout(view, evidence, focus) : null;
  const imageProps = { src: evidence.frameUrl };

  return (
    <figure className="mt-3">
      <figcaption className="text-xs font-semibold text-muted">{t.basket.where}</figcaption>
      <div ref={ref} className="relative mt-1.5 aspect-4/3 w-full overflow-hidden rounded-control bg-canvas">
        {layout && (
          <>
            {/* Data URL of the scanned frame; next/image does not apply. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              {...imageProps}
              alt={t.basket.where}
              className="absolute max-w-none"
              style={{ left: layout.left, top: layout.top, width: layout.width, height: layout.height }}
            />

            {[...shown].map(([box, mark], index) => {
              // Boxes are clipped to the visible part of the photo.
              const x1 = clamp(layout.left + box.x1 * layout.width, 0, view.width);
              const y1 = clamp(layout.top + box.y1 * layout.height, 0, view.height);
              const x2 = clamp(layout.left + box.x2 * layout.width, 0, view.width);
              const y2 = clamp(layout.top + box.y2 * layout.height, 0, view.height);
              if (x2 - x1 < MIN_BOX_PX || y2 - y1 < MIN_BOX_PX) return null;

              const found = mark.target.state === "product";
              const label = found
                ? t.basket.inShop(mark.name ?? "")
                : mark.target.state === "error"
                  ? t.point.identity.error
                  : t.basket.notInShop;

              return (
                <div key={index}>
                  <div
                    className={`absolute rounded-md border-2 ${found ? "border-verified" : "border-dashed border-white/90"}`}
                    style={{ left: x1, top: y1, width: x2 - x1, height: y2 - y1 }}
                  />
                  <span
                    className={`absolute flex max-w-[60%] -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white shadow-card ${
                      found ? "bg-verified" : "bg-ink/80"
                    }`}
                    style={{
                      left: clamp((x1 + x2) / 2, LABEL_MARGIN_X, view.width - LABEL_MARGIN_X),
                      top: clamp(y1, LABEL_MARGIN_Y, view.height - LABEL_MARGIN_Y),
                    }}
                  >
                    {found && <Check aria-hidden size={11} strokeWidth={3} className="shrink-0" />}
                    <span className="truncate">{label}</span>
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </figure>
  );
}
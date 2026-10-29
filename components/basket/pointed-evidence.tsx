"use client";

import { useMessages } from "@/lib/i18n/locale";
import type { Messages } from "@/lib/i18n/messages";
import type { Evidence, EvidenceMark } from "@/lib/pointing/locate";

function markLabel(mark: EvidenceMark, t: Messages): string {
  switch (mark.target.state) {
    case "product":
      return mark.name ?? mark.target.sku;
    case "unknown":
      return t.point.identity.unknown;
    case "ambiguous":
      return t.point.identity.ambiguous;
    case "none":
      return t.basket.nothingHere;
    default:
      return t.point.identity.error;
  }
}

const percent = (value: number) => `${value * 100}%`;

// The scanned counter with every pointing numbered in order, so the user can check what was understood.
export function PointedEvidence({ evidence }: { evidence: Evidence }) {
  const t = useMessages();
  const imageProps = { src: evidence.frameUrl };

  return (
    <figure className="mt-3">
      <figcaption className="text-xs font-semibold text-muted">{t.basket.where}</figcaption>
      <div
        className="relative mt-1 overflow-hidden rounded-control bg-ink"
        style={{ aspectRatio: `${evidence.width} / ${evidence.height}` }}
      >
        {/* Data URL of the scanned frame; next/image does not apply. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...imageProps} alt="" className="absolute inset-0 h-full w-full" />

        {evidence.marks.map((mark, index) => {
          const found = mark.target.state === "product";
          const tone = found ? "bg-primary" : "bg-attention";
          const anchor = mark.box
            ? { left: percent(mark.box.x1), top: percent(mark.box.y1) }
            : { left: percent(mark.tip.x), top: percent(mark.tip.y) };

          return (
            <div key={index}>
              {mark.box && (
                <div
                  className={`absolute rounded-md border-2 ${found ? "border-primary" : "border-dashed border-attention"}`}
                  style={{
                    left: percent(mark.box.x1),
                    top: percent(mark.box.y1),
                    width: percent(mark.box.x2 - mark.box.x1),
                    height: percent(mark.box.y2 - mark.box.y1),
                  }}
                />
              )}
              <span
                className={`absolute flex max-w-40 -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white ${tone}`}
                style={anchor}
              >
                {index + 1}
                <span className="truncate font-medium">· {markLabel(mark, t)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
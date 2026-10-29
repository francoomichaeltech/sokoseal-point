"use client";

import { Check } from "lucide-react";
import type { Box } from "@/lib/grounding/types";
import { useMessages } from "@/lib/i18n/locale";
import type { Evidence, PointedMark } from "@/lib/pointing/locate";

// Keeps the photo short so the request card stays compact.
const MAX_HEIGHT_REM = 15;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const pct = (value: number) => `${value * 100}%`;

type PointedEvidenceProps = { evidence: Evidence; marks: PointedMark[] };

// The counter as the camera saw it, with each pointed product labelled in stock or not. No numbers.
export function PointedEvidence({ evidence, marks }: PointedEvidenceProps) {
  const t = useMessages();
  // Each object once, even if it was pointed at more than once.
  const shown = new Map<Box, PointedMark>();
  for (const mark of marks) if (mark.box && !shown.has(mark.box)) shown.set(mark.box, mark);

  const ratio = evidence.width / evidence.height;
  const imageProps = { src: evidence.frameUrl };

  return (
    <figure className="mt-3">
      <figcaption className="text-xs font-semibold text-muted">{t.basket.where}</figcaption>
      <div className="mt-1.5 flex justify-center overflow-hidden rounded-control bg-ink">
        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: `${evidence.width} / ${evidence.height}`, width: `min(100%, ${MAX_HEIGHT_REM * ratio}rem)` }}
        >
          {/* Data URL of the scanned frame; next/image does not apply. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...imageProps} alt={t.basket.where} className="absolute inset-0 h-full w-full" />

          {[...shown].map(([box, mark], index) => {
            const x1 = clamp01(box.x1);
            const y1 = clamp01(box.y1);
            const x2 = clamp01(box.x2);
            const y2 = clamp01(box.y2);
            const found = mark.target.state === "product";
            const label = found
              ? t.basket.inShop(mark.name ?? "")
              : mark.target.state === "error"
                ? t.point.identity.error
                : t.basket.notInShop;

            return (
              <div key={index}>
                <div
                  className={`absolute rounded-md border-2 ${found ? "border-verified" : "border-dashed border-white/80"}`}
                  style={{ left: pct(x1), top: pct(y1), width: pct(x2 - x1), height: pct(y2 - y1) }}
                />
                {/* Centred on the box and clamped, so the label never leaves the photo. */}
                <span
                  className={`absolute flex max-w-[75%] -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white shadow-card ${
                    found ? "bg-verified" : "bg-ink/80"
                  }`}
                  style={{ left: `clamp(20%, ${((x1 + x2) / 2) * 100}%, 80%)`, top: `clamp(6%, ${y1 * 100}%, 94%)` }}
                >
                  {found && <Check aria-hidden size={11} strokeWidth={3} className="shrink-0" />}
                  <span className="truncate">{label}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </figure>
  );
}
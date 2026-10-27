"use client";

import { useRef } from "react";
import { Camera, Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { useMessages } from "@/lib/i18n/locale";
import type { Messages } from "@/lib/i18n/messages";
import { useCamera } from "@/lib/media/use-camera";
import { RING_LENGTH, RING_RADIUS, SPOT_GRADIENT, SPOT_SIZE } from "@/lib/pointing/draw";
import { usePointer } from "@/lib/pointing/use-pointer";
import { boxToView } from "@/lib/pointing/viewport";
import { useElementSize } from "@/lib/use-element-size";

type Tone = "neutral" | "busy" | "verified" | "attention";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-ink/70",
  busy: "bg-ink/70",
  verified: "bg-verified",
  attention: "bg-attention",
};

function statusChip(pointer: ReturnType<typeof usePointer>, t: Messages["point"]): { text: string; tone: Tone } {
  if (pointer.status === "error") return { text: t.pointing.unsupported, tone: "attention" };
  if (pointer.status === "loading") return { text: t.pointing.loading, tone: "busy" };
  if (pointer.checking) return { text: t.ground.checking, tone: "busy" };

  switch (pointer.committed?.status) {
    case "MATCH":
      return { text: t.ground.match, tone: "verified" };
    case "AMBIGUOUS":
      return { text: t.ground.ambiguous, tone: "attention" };
    case "NONE":
      return { text: t.ground.none, tone: "attention" };
    case "ERROR":
      return { text: t.ground.error, tone: "attention" };
  }

  return pointer.handVisible
    ? { text: t.pointing.aim, tone: "neutral" }
    : { text: t.pointing.searching, tone: "neutral" };
}

export function CameraView() {
  const { videoRef, status, start } = useCamera();
  const [viewRef, view] = useElementSize<HTMLDivElement>();
  const beamRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const t = useMessages().point;

  const live = status === "live";
  const pointer = usePointer(videoRef, {
    enabled: live,
    overlay: { container: viewRef, beam: beamRef, spot: spotRef, ring: ringRef, hover: hoverRef },
  });
  const { committed } = pointer;
  const chip = statusChip(pointer, t);
  const half = SPOT_SIZE / 2;

  return (
    <div ref={viewRef} className="viewfinder h-full rounded-card">
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

      {live && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {committed?.status === "MATCH" && (
            <div
              className="absolute rounded-lg border-[3px] border-primary shadow-[0_0_0_1px_rgb(255_255_255/0.8)]"
              style={boxToView(committed.box, view, committed.frame)}
            />
          )}

          {committed?.status === "AMBIGUOUS" &&
            committed.boxes.map((box, index) => (
              <div
                key={index}
                className="absolute rounded-lg border-2 border-dashed border-attention"
                style={boxToView(box, view, committed.frame)}
              />
            ))}

          {/* Positioned every frame by drawPointer. */}
          <div ref={hoverRef} className="absolute top-0 left-0 rounded-lg border-2 border-white/90 opacity-0" />
          <div
            ref={beamRef}
            className="absolute top-0 left-0 -mt-1 h-2 origin-[0_50%] rounded-full bg-linear-to-r from-white/0 to-primary/60 opacity-0"
          />
          <div ref={spotRef} className="absolute top-0 left-0 opacity-0" style={{ width: SPOT_SIZE, height: SPOT_SIZE }}>
            <div className="absolute inset-0 rounded-full" style={{ background: SPOT_GRADIENT }} />
            <svg viewBox={`0 0 ${SPOT_SIZE} ${SPOT_SIZE}`} className="absolute inset-0">
              <circle
                ref={ringRef}
                cx={half}
                cy={half}
                r={RING_RADIUS}
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={RING_LENGTH}
                strokeDashoffset={RING_LENGTH}
                transform={`rotate(-90 ${half} ${half})`}
                className="stroke-white"
              />
            </svg>
          </div>
        </div>
      )}

      {live ? (
        <p
          role="status"
          className={`pointer-events-none absolute inset-x-0 bottom-3 mx-auto flex w-fit max-w-[90%] items-center gap-1.5 rounded-full px-3 py-1.5 text-center text-sm text-white ${TONE_CLASS[chip.tone]}`}
        >
          {chip.tone === "busy" && <LoaderCircle aria-hidden size={16} className="shrink-0 animate-spin" />}
          {chip.tone === "verified" && <Check aria-hidden size={16} className="shrink-0" />}
          {chip.tone === "attention" && <TriangleAlert aria-hidden size={16} className="shrink-0" />}
          {chip.text}
        </p>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink p-6 text-center text-white">
          {status === "checking" || status === "starting" ? (
            <LoaderCircle aria-hidden size={28} className="animate-spin" />
          ) : (
            <Camera aria-hidden size={32} strokeWidth={1.5} />
          )}

          <p role="status" className="max-w-64 text-sm">
            {status === "checking" ? t.camera.starting : t.camera[status]}
          </p>

          {status !== "checking" && status !== "starting" && status !== "unavailable" && (
            <button
              type="button"
              onClick={start}
              className="tap-target rounded-card bg-primary px-5 font-semibold text-white"
            >
              {status === "idle" ? t.camera.start : t.camera.retry}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
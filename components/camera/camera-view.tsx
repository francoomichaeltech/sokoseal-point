"use client";

import { Camera, Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { useGrounding, type GroundingState } from "@/lib/grounding/use-grounding";
import { useMessages } from "@/lib/i18n/locale";
import type { Messages } from "@/lib/i18n/messages";
import { captureFrame } from "@/lib/media/capture";
import { useCamera } from "@/lib/media/use-camera";
import { usePointing, type TrackerStatus, type Tracking } from "@/lib/pointing/use-pointing";
import { boxToView, pointToView } from "@/lib/pointing/viewport";
import { useElementSize } from "@/lib/use-element-size";

type Tone = "neutral" | "busy" | "verified" | "attention";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-ink/70",
  busy: "bg-ink/70",
  verified: "bg-verified",
  attention: "bg-attention",
};

const RING_RADIUS = 16;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const RAY_LENGTH_PX = 48;

function statusChip(
  tracker: TrackerStatus,
  tracking: Tracking,
  grounding: GroundingState,
  t: Messages["point"],
): { text: string; tone: Tone } {
  if (tracker === "error") return { text: t.pointing.unsupported, tone: "attention" };
  if (tracker === "loading") return { text: t.pointing.loading, tone: "busy" };
  if (grounding.phase === "checking") return { text: t.ground.checking, tone: "busy" };

  if (grounding.phase === "done") {
    switch (grounding.result.status) {
      case "MATCH":
        return { text: t.ground.match, tone: "verified" };
      case "AMBIGUOUS":
        return { text: t.ground.ambiguous, tone: "attention" };
      case "NONE":
        return { text: t.ground.none, tone: "attention" };
      default:
        return { text: t.ground.error, tone: "attention" };
    }
  }

  if (tracking.pointer && tracking.progress > 0.2) return { text: t.pointing.steady, tone: "neutral" };
  return { text: t.pointing.searching, tone: "neutral" };
}

export function CameraView() {
  const { videoRef, status, start } = useCamera();
  const { state: grounding, ground, clear } = useGrounding();
  const [viewRef, view] = useElementSize<HTMLDivElement>();
  const t = useMessages().point;

  const holdWhenLost =
    grounding.phase === "checking" ||
    (grounding.phase === "done" && grounding.result.status === "MATCH");

  const { status: tracker, tracking } = usePointing(videoRef, {
    enabled: status === "live",
    holdWhenLost,
    onDwell: (pointer) => {
      const video = videoRef.current;
      const frame = video ? captureFrame(video) : null;
      if (frame) void ground(frame, pointer);
    },
    onRelease: clear,
  });

  const live = status === "live";
  const { frame, pointer, progress } = tracking;
  const result = grounding.phase === "done" ? grounding.result : null;
  const chip = statusChip(tracker, tracking, grounding, t);

  const tip = live && frame && pointer ? pointToView(pointer.tip, view, frame) : null;
  // Direction is in normalized frame units; converted to pixels for the on-screen angle.
  const rayAngle =
    frame && pointer
      ? Math.atan2(pointer.direction.y * frame.height, pointer.direction.x * frame.width)
      : 0;

  return (
    <div ref={viewRef} className="viewfinder h-full rounded-card">
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

      {live && frame && result?.status === "MATCH" && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-lg border-[3px] border-primary shadow-[0_0_0_1px_rgb(255_255_255/0.8)]"
          style={boxToView(result.box, view, frame)}
        />
      )}

      {live &&
        frame &&
        result?.status === "AMBIGUOUS" &&
        result.boxes.map((box, index) => (
          <div
            key={index}
            aria-hidden
            className="pointer-events-none absolute rounded-lg border-2 border-dashed border-attention"
            style={boxToView(box, view, frame)}
          />
        ))}

      {tip && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute h-[3px] rounded-full bg-primary"
            style={{
              left: tip.left,
              top: tip.top,
              width: RAY_LENGTH_PX,
              transform: `translateY(-50%) rotate(${rayAngle}rad)`,
              transformOrigin: "0 50%",
            }}
          />
          <svg
            aria-hidden
            viewBox="0 0 40 40"
            className="pointer-events-none absolute size-10 -translate-x-1/2 -translate-y-1/2"
            style={tip}
          >
            <circle cx="20" cy="20" r={RING_RADIUS} fill="none" strokeWidth="3" className="stroke-white/60" />
            <circle
              cx="20"
              cy="20"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - progress)}
              transform="rotate(-90 20 20)"
              className="stroke-primary"
            />
            <circle cx="20" cy="20" r="4" className="fill-primary" />
          </svg>
        </>
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
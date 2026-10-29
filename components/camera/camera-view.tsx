"use client";

import type { PointerEvent } from "react";
import { Camera, Hand, LoaderCircle } from "lucide-react";
import type { Point } from "@/lib/grounding/types";
import { useMessages } from "@/lib/i18n/locale";
import type { useCamera } from "@/lib/media/use-camera";
import type { TrackerStatus } from "@/lib/pointing/use-pointing-session";
import { viewToFrame } from "@/lib/pointing/viewport";

type CameraViewProps = {
  camera: ReturnType<typeof useCamera>;
  tracker: TrackerStatus;
  /** Used only when hand tracking failed: a tap marks the pointed product. */
  onTap: (point: Point) => void;
};

export function CameraView({ camera, tracker, onTap }: CameraViewProps) {
  const { videoRef, status, start } = camera;
  const t = useMessages().point;
  const live = status === "live";
  const tapMode = live && tracker === "error";

  function handleTap(event: PointerEvent<HTMLDivElement>) {
    const video = videoRef.current;
    if (!tapMode || !video?.videoWidth) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const point = viewToFrame(
      event.clientX - rect.left,
      event.clientY - rect.top,
      { width: rect.width, height: rect.height },
      { width: video.videoWidth, height: video.videoHeight },
    );
    if (point) onTap(point);
  }

  return (
    <div onPointerDown={handleTap} className="viewfinder h-full rounded-card">
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

      {live ? (
        <p
          role="status"
          className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto flex w-fit max-w-[90%] items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1.5 text-center text-sm text-white"
        >
          {tapMode && <Hand aria-hidden size={16} className="shrink-0" />}
          {tapMode ? t.pointing.tapFallback : t.hint}
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
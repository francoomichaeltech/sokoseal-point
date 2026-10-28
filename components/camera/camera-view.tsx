"use client";

import { Camera, LoaderCircle, TriangleAlert } from "lucide-react";
import type { Selection } from "@/lib/grounding/types";
import { useMessages } from "@/lib/i18n/locale";
import type { useCamera } from "@/lib/media/use-camera";
import type { TrackerStatus } from "@/lib/pointing/use-pointing-session";
import { boxToView } from "@/lib/pointing/viewport";
import { useElementSize } from "@/lib/use-element-size";

export type Pointed = {
  frame: { width: number; height: number };
  /** One entry per finger pause, in the order they happened. */
  selections: Selection[];
  scanFailed: boolean;
};

type CameraViewProps = {
  camera: ReturnType<typeof useCamera>;
  tracker: TrackerStatus;
  pointed: Pointed | null;
};

export function CameraView({ camera, tracker, pointed }: CameraViewProps) {
  const { videoRef, status, start } = camera;
  const [viewRef, view] = useElementSize<HTMLDivElement>();
  const t = useMessages().point;
  const live = status === "live";

  const chip =
    tracker === "error"
      ? { text: t.pointing.unsupported, tone: "attention" }
      : tracker === "loading"
        ? { text: t.pointing.loading, tone: "busy" }
        : pointed?.scanFailed
          ? { text: t.ground.error, tone: "attention" }
          : { text: t.hint, tone: "neutral" };

  return (
    <div ref={viewRef} className="viewfinder h-full rounded-card">
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

      {live && pointed && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {pointed.selections.map((selection, index) => {
            const matched = selection.status === "MATCH";
            const boxes =
              selection.status === "MATCH" ? [selection.box] : selection.status === "AMBIGUOUS" ? selection.boxes : [];

            return boxes.map((box, boxIndex) => (
              <div
                key={`${index}-${boxIndex}`}
                className={`absolute rounded-lg ${
                  matched
                    ? "border-[3px] border-primary shadow-[0_0_0_1px_rgb(255_255_255/0.8)]"
                    : "border-2 border-dashed border-attention"
                }`}
                style={boxToView(box, view, pointed.frame)}
              >
                <span
                  className={`absolute -top-3 -left-3 grid size-6 place-items-center rounded-full text-xs font-semibold text-white ${
                    matched ? "bg-primary" : "bg-attention"
                  }`}
                >
                  {index + 1}
                </span>
              </div>
            ));
          })}
        </div>
      )}

      {live ? (
        <p
          role="status"
          className={`pointer-events-none absolute inset-x-0 bottom-3 mx-auto flex w-fit max-w-[90%] items-center gap-1.5 rounded-full px-3 py-1.5 text-center text-sm text-white ${
            chip.tone === "attention" ? "bg-attention" : "bg-ink/70"
          }`}
        >
          {chip.tone === "busy" && <LoaderCircle aria-hidden size={16} className="shrink-0 animate-spin" />}
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
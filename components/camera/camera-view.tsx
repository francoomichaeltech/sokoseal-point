"use client";

import { Camera, LoaderCircle } from "lucide-react";
import { useMessages } from "@/lib/i18n/locale";
import { useCamera } from "@/lib/media/use-camera";

export function CameraView() {
  const { videoRef, status, start } = useCamera();
  const t = useMessages().point;

  const busy = status === "checking" || status === "starting";
  const message =
    status === "checking" || status === "starting"
      ? t.camera.starting
      : status === "live"
        ? null
        : t.camera[status];

  return (
    <div className="viewfinder h-full rounded-card">
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

      {status === "live" ? (
        <p className="absolute inset-x-0 bottom-3 mx-auto w-fit max-w-[90%] rounded-full bg-ink/70 px-3 py-1.5 text-center text-sm text-white">
          {t.hint}
        </p>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink p-6 text-center text-white">
          {busy ? (
            <LoaderCircle aria-hidden size={28} className="animate-spin" />
          ) : (
            <Camera aria-hidden size={32} strokeWidth={1.5} />
          )}

          <p role="status" className="max-w-64 text-sm">
            {message}
          </p>

          {!busy && status !== "unavailable" && (
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
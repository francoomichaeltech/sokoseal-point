"use client";

import { Camera } from "lucide-react";
import { useMessages } from "@/lib/i18n/locale";
import { useCamera } from "@/lib/media/use-camera";

export function CameraView() {
  const { videoRef, status, start } = useCamera();
  const t = useMessages().point.camera;

  return (
    <div className="viewfinder aspect-[3/4] rounded-card">
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />

      {status !== "live" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink p-6 text-center text-white">
          <Camera aria-hidden size={32} strokeWidth={1.5} />
          <p className="max-w-64 text-sm">{t[status]}</p>

          {status !== "unavailable" && (
            <button
              type="button"
              onClick={start}
              disabled={status === "starting"}
              className="tap-target rounded-card bg-primary px-5 font-semibold text-white disabled:opacity-60"
            >
              {status === "idle" || status === "starting" ? t.start : t.retry}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
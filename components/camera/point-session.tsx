"use client";

import { useRef, useState } from "react";
import { requestScan } from "@/lib/grounding/scan-client";
import type { ScanResult } from "@/lib/grounding/types";
import { captureFrame } from "@/lib/media/capture";
import { useCamera } from "@/lib/media/use-camera";
import { resolveDwell } from "@/lib/pointing/resolve";
import { usePointingSession } from "@/lib/pointing/use-pointing-session";
import { CameraView, type Pointed } from "./camera-view";
import { HoldToSpeak } from "./hold-to-speak";

type Scan = { result: ScanResult; frame: { width: number; height: number } };

export function PointSession() {
  const camera = useCamera();
  const pointing = usePointingSession(camera.videoRef, camera.status === "live");
  const [pointed, setPointed] = useState<Pointed | null>(null);
  const scanRef = useRef<Promise<Scan> | null>(null);
  // A new hold makes a scan still in flight stale.
  const holdRef = useRef(0);

  function handleHoldStart() {
    holdRef.current += 1;
    setPointed(null);
    pointing.begin();

    // Scanned at the press, before the hand moves in: SAM missed most objects in frames with a hand.
    const video = camera.videoRef.current;
    const frame = video ? captureFrame(video) : null;
    scanRef.current = frame
      ? requestScan(frame.url).then((result) => ({ result, frame: { width: frame.width, height: frame.height } }))
      : null;
  }

  async function handleHoldEnd(accepted: boolean) {
    const dwells = pointing.end();
    const scan = scanRef.current;
    scanRef.current = null;
    if (!accepted || !scan) return;

    const id = holdRef.current;
    const { result, frame } = await scan;
    if (id !== holdRef.current) return;

    setPointed(
      result.status === "OK"
        ? { frame, selections: dwells.map((dwell) => resolveDwell(result.boxes, dwell)), scanFailed: false }
        : { frame, selections: [], scanFailed: true },
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col gap-4 p-4">
      <div className="min-h-0 flex-1">
        <CameraView camera={camera} tracker={pointing.status} pointed={pointed} />
      </div>
      <HoldToSpeak
        onHoldStart={handleHoldStart}
        onHoldEnd={(accepted) => void handleHoldEnd(accepted)}
        pointCount={pointing.count}
      />
    </div>
  );
}
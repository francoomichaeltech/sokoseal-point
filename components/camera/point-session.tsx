"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useProducts } from "@/lib/catalogue/store";
import { requestScan } from "@/lib/grounding/scan-client";
import { captureFrame } from "@/lib/media/capture";
import { useCamera } from "@/lib/media/use-camera";
import type { Recording } from "@/lib/media/use-mic";
import { locateTargets, type Scan } from "@/lib/pointing/locate";
import { createThumbnailer, sceneDifference, type Thumbnail } from "@/lib/pointing/scene";
import { usePointingSession } from "@/lib/pointing/use-pointing-session";
import { runHold } from "@/lib/requests/run-hold";
import { catalogueKeywords, voiceKeywords } from "@/lib/voice/keywords";
import { CameraView } from "./camera-view";
import { HoldToSpeak } from "./hold-to-speak";
import { PointTips } from "./point-tips";

// SAM missed most objects in frames with a hand, so the counter is scanned in the background
// while no hand is in view and a hold uses that scan straight away.
const CHECK_INTERVAL_MS = 700;
const HAND_CLEAR_MS = 700;
const SCENE_CHANGE = 14;
const SCAN_MAX_AGE_MS = 30_000;

type CachedScan = { scan: Scan; thumbnail: Thumbnail; at: number };

export function PointSession() {
  const router = useRouter();
  const camera = useCamera();
  const products = useProducts();
  const pointing = usePointingSession(camera.videoRef, camera.status === "live");
  const cacheRef = useRef<CachedScan | null>(null);
  const scanRef = useRef<Promise<Scan> | null>(null);
  const holdingRef = useRef(false);

  const { status: cameraStatus, videoRef } = camera;
  const { status: trackerStatus, handSeenAtRef } = pointing;

  useEffect(() => {
    // Also runs when tracking failed, so the tap fallback has a scan to resolve taps against.
    if (cameraStatus !== "live" || trackerStatus === "loading") return;

    const thumbnail = createThumbnailer();
    let busy = false;

    const timer = window.setInterval(() => {
      const video = videoRef.current;
      const now = performance.now();
      if (busy || holdingRef.current || !video || now - handSeenAtRef.current < HAND_CLEAR_MS) return;

      const snapshot = thumbnail(video);
      if (!snapshot) return;

      const cached = cacheRef.current;
      const unchanged =
        cached && now - cached.at < SCAN_MAX_AGE_MS && sceneDifference(cached.thumbnail, snapshot) < SCENE_CHANGE;
      if (unchanged) return;

      const frame = captureFrame(video);
      if (!frame) return;

      busy = true;
      void requestScan(frame.url).then((result) => {
        busy = false;
        if (result.status !== "OK") return;
        cacheRef.current = { scan: { result, frame }, thumbnail: snapshot, at: performance.now() };
      });
    }, CHECK_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [cameraStatus, trackerStatus, videoRef, handSeenAtRef]);

  function handleHoldStart() {
    holdingRef.current = true;
    pointing.begin();

    const cached = cacheRef.current;
    if (cached && performance.now() - cached.at < SCAN_MAX_AGE_MS) {
      scanRef.current = Promise.resolve(cached.scan);
      return;
    }

    // No recent background scan (for example right after the camera started): scan now.
    const video = videoRef.current;
    const frame = video ? captureFrame(video) : null;
    scanRef.current = frame ? requestScan(frame.url).then((result) => ({ result, frame })) : null;
  }

  function handleHoldEnd(recording: Recording | null) {
    holdingRef.current = false;
    const samples = pointing.end();
    const scan = scanRef.current;
    scanRef.current = null;
    if (!recording) return;

    const catalogue = products ?? [];
    void runHold({
      eventId: crypto.randomUUID(),
      wav: recording.wav,
      voiceHints: voiceKeywords(catalogue),
      productNames: catalogueKeywords(catalogue),
      // Grounding and identity run while the speech is transcribed.
      located: locateTargets(scan, samples, catalogue),
    });
    router.push("/basket");
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col gap-4 p-4">
      <div className="relative min-h-0 flex-1">
        <CameraView camera={camera} tracker={pointing.status} onTap={pointing.addTap} />
        <PointTips />
      </div>
      <HoldToSpeak
        onHoldStart={handleHoldStart}
        onHoldEnd={handleHoldEnd}
        handVisible={pointing.status === "ready" ? pointing.handVisible : null}
      />
    </div>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";
import { useProducts } from "@/lib/catalogue/store";
import { requestScan } from "@/lib/grounding/scan-client";
import type { Box, ScanResult } from "@/lib/grounding/types";
import { identifyTargets } from "@/lib/identity/identify-targets";
import type { TargetIdentity } from "@/lib/identity/types";
import { captureFrame, type Frame } from "@/lib/media/capture";
import { useCamera } from "@/lib/media/use-camera";
import { resolveDwell } from "@/lib/pointing/resolve";
import { createThumbnailer, sceneDifference, type Thumbnail } from "@/lib/pointing/scene";
import { usePointingSession } from "@/lib/pointing/use-pointing-session";
import { CameraView, type Pointed } from "./camera-view";
import { HoldToSpeak } from "./hold-to-speak";

// SAM missed most objects in frames with a hand, so the counter is scanned in the background
// while no hand is in view and a hold uses that scan straight away.
const CHECK_INTERVAL_MS = 700;
const HAND_CLEAR_MS = 700;
const SCENE_CHANGE = 14;
const SCAN_MAX_AGE_MS = 30_000;

type Scan = { result: ScanResult; frame: Frame };
type CachedScan = { scan: Scan; thumbnail: Thumbnail; at: number };

export function PointSession() {
  const camera = useCamera();
  const products = useProducts();
  const pointing = usePointingSession(camera.videoRef, camera.status === "live");
  const [pointed, setPointed] = useState<Pointed | null>(null);
  const cacheRef = useRef<CachedScan | null>(null);
  const scanRef = useRef<Promise<Scan> | null>(null);
  const holdingRef = useRef(false);
  // A new hold makes a result still in flight stale.
  const holdRef = useRef(0);

  const { status: cameraStatus, videoRef } = camera;
  const { status: trackerStatus, handSeenAtRef } = pointing;

  useEffect(() => {
    if (cameraStatus !== "live" || trackerStatus !== "ready") return;

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
    holdRef.current += 1;
    holdingRef.current = true;
    setPointed(null);
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

  async function handleHoldEnd(accepted: boolean) {
    holdingRef.current = false;
    const dwells = pointing.end();
    const scan = scanRef.current;
    scanRef.current = null;
    if (!accepted || !scan) return;

    const id = holdRef.current;
    const { result, frame } = await scan;
    if (id !== holdRef.current) return;

    if (result.status !== "OK") {
      setPointed({ frame, selections: [], labels: [], objectCount: 0, scanFailed: true });
      return;
    }

    const selections = dwells.map((dwell) => resolveDwell(result.boxes, dwell));
    // One identity check per object, even if it was pointed at more than once.
    const targets: Box[] = [
      ...new Set(selections.flatMap((selection) => (selection.status === "MATCH" ? [selection.box] : []))),
    ];
    const labelsFor = (identities: TargetIdentity[]) =>
      selections.map((selection) =>
        selection.status === "MATCH" ? (identities[targets.indexOf(selection.box)] ?? null) : null,
      );

    setPointed({
      frame,
      selections,
      labels: labelsFor(targets.map((): TargetIdentity => ({ state: "pending" }))),
      objectCount: result.boxes.length,
      scanFailed: false,
    });
    if (targets.length === 0) return;

    // Runs while the transcript is processed, so it adds little to the wait.
    const identities = await identifyTargets(frame.url, targets, products ?? []);
    if (id !== holdRef.current) return;
    setPointed((current) => current && { ...current, labels: labelsFor(identities) });
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
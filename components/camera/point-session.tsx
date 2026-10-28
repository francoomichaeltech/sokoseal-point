"use client";

import { useEffect, useRef, useState } from "react";
import { useProducts } from "@/lib/catalogue/store";
import { applyHold } from "@/lib/commerce/store";
import { toPointedTargets } from "@/lib/commerce/targets";
import type { PointedTarget } from "@/lib/commerce/types";
import { requestScan } from "@/lib/grounding/scan-client";
import type { Box, ScanResult } from "@/lib/grounding/types";
import { identifyTargets } from "@/lib/identity/identify-targets";
import type { TargetIdentity } from "@/lib/identity/types";
import type { Intent } from "@/lib/intent/types";
import { captureFrame, type Frame } from "@/lib/media/capture";
import { useCamera } from "@/lib/media/use-camera";
import type { Dwell } from "@/lib/pointing/dwell";
import { resolveDwell } from "@/lib/pointing/resolve";
import { createThumbnailer, sceneDifference, type Thumbnail } from "@/lib/pointing/scene";
import { usePointingSession } from "@/lib/pointing/use-pointing-session";
import { CameraView, type Pointed } from "./camera-view";
import { HoldToSpeak } from "./hold-to-speak";
import { OutcomeList, type HoldOutcome } from "./outcome-list";

// SAM missed most objects in frames with a hand, so the counter is scanned in the background
// while no hand is in view and a hold uses that scan straight away.
const CHECK_INTERVAL_MS = 700;
const HAND_CLEAR_MS = 700;
const SCENE_CHANGE = 14;
const SCAN_MAX_AGE_MS = 30_000;

type Scan = { result: ScanResult; frame: Frame };
type CachedScan = { scan: Scan; thumbnail: Thumbnail; at: number };
type HoldTargets = { id: number; promise: Promise<PointedTarget[]> };

export function PointSession() {
  const camera = useCamera();
  const products = useProducts();
  const pointing = usePointingSession(camera.videoRef, camera.status === "live");
  const [pointed, setPointed] = useState<Pointed | null>(null);
  const [outcome, setOutcome] = useState<HoldOutcome | null>(null);
  const cacheRef = useRef<CachedScan | null>(null);
  const scanRef = useRef<Promise<Scan> | null>(null);
  const targetsRef = useRef<HoldTargets | null>(null);
  const eventRef = useRef("");
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
    // One id per hold; the basket ignores an id it has already applied.
    eventRef.current = crypto.randomUUID();
    targetsRef.current = null;
    setPointed(null);
    setOutcome(null);
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

  async function locateTargets(id: number, scan: Promise<Scan>, dwells: Dwell[]): Promise<PointedTarget[]> {
    const { result, frame } = await scan;
    if (result.status !== "OK") {
      if (id === holdRef.current) setPointed({ frame, selections: [], labels: [], objectCount: 0, scanFailed: true });
      return dwells.map((): PointedTarget => ({ state: "error" }));
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

    if (id === holdRef.current) {
      setPointed({
        frame,
        selections,
        labels: labelsFor(targets.map((): TargetIdentity => ({ state: "pending" }))),
        objectCount: result.boxes.length,
        scanFailed: false,
      });
    }

    // Runs while the speech is processed, so it adds little to the wait.
    const identities = targets.length > 0 ? await identifyTargets(frame.url, targets, products ?? []) : [];
    const labels = labelsFor(identities);
    if (id === holdRef.current) setPointed((current) => current && { ...current, labels });
    return toPointedTargets(selections, labels);
  }

  function handleHoldEnd(accepted: boolean) {
    holdingRef.current = false;
    const dwells = pointing.end();
    const scan = scanRef.current;
    scanRef.current = null;
    if (!accepted) return;

    const id = holdRef.current;
    const failed = () => dwells.map((): PointedTarget => ({ state: "error" }));
    // Set before any await so handleIntent, which runs after transcription, always finds it.
    targetsRef.current = {
      id,
      promise: scan ? locateTargets(id, scan, dwells).catch(failed) : Promise.resolve(failed()),
    };
  }

  async function handleIntent(intent: Intent) {
    const id = holdRef.current;
    const eventId = eventRef.current;
    if (intent.actions.length === 0) return;

    setOutcome({ phase: "checking" });
    const pending = targetsRef.current;
    const targets = pending?.id === id ? await pending.promise : [];
    if (id !== holdRef.current) return;

    const outcomes = applyHold(eventId, intent.actions, targets, products ?? []);
    setOutcome(outcomes ? { phase: "done", outcomes } : null);
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col gap-4 p-4">
      <div className="min-h-0 flex-1">
        <CameraView camera={camera} tracker={pointing.status} pointed={pointed} />
      </div>
      <HoldToSpeak
        onHoldStart={handleHoldStart}
        onHoldEnd={handleHoldEnd}
        onIntent={(intent) => void handleIntent(intent)}
        pointCount={pointing.count}
      >
        {outcome && <OutcomeList outcome={outcome} />}
      </HoldToSpeak>
    </div>
  );
}
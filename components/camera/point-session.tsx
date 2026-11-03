"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useProducts } from "@/lib/catalogue/store";
import { requestScan } from "@/lib/grounding/scan-client";
import { captureFrame, captureSharpestFrame, type Frame } from "@/lib/media/capture";
import { useCamera } from "@/lib/media/use-camera";
import type { Recording } from "@/lib/media/use-mic";
import {
  createScanIdentityCache,
  locateTargets,
  preIdentifyVisits,
  scanWithFallback,
  type Scan,
  type ScanIdentityCache,
} from "@/lib/pointing/locate";
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
const SCENE_CHANGE = 8;
const SCAN_MAX_AGE_MS = 8_000;
const RECENT_FRAME_COUNT = 4;
const PRE_IDENTIFY_INTERVAL_MS = 250;

type CachedScan = { scan: Scan; thumbnail: Thumbnail | null; at: number };

export function PointSession() {
  const router = useRouter();
  const camera = useCamera();
  const products = useProducts();
  const pointing = usePointingSession(camera.videoRef, camera.status === "live");
  const cacheRef = useRef<CachedScan | null>(null);
  const thumbnailerRef = useRef<((video: HTMLVideoElement) => Thumbnail | null) | null>(null);
  const recentFramesRef = useRef<Frame[]>([]);
  const scanRef = useRef<Promise<Scan | null> | null>(null);
  const identityCacheRef = useRef<ScanIdentityCache | null>(null);
  const preIdentifyTimerRef = useRef<number | null>(null);
  const holdingRef = useRef(false);

  const { status: cameraStatus, videoRef } = camera;
  const { status: trackerStatus, handSeenAtRef } = pointing;

  useEffect(() => {
    // Also runs when tracking failed, so the tap fallback has a scan to resolve taps against.
    if (cameraStatus !== "live" || trackerStatus === "loading") return;

    const thumbnail = createThumbnailer();
    thumbnailerRef.current = thumbnail;
    let busy = false;

    const checkCounter = () => {
      const video = videoRef.current;
      const now = performance.now();
      if (holdingRef.current || !video || now - handSeenAtRef.current < HAND_CLEAR_MS) return;

      const latestFrame = captureFrame(video);
      if (latestFrame) {
        const buffer = [...recentFramesRef.current, latestFrame];
        recentFramesRef.current = buffer.slice(-RECENT_FRAME_COUNT);
      }

      if (busy) return;
      const snapshot = thumbnail(video);
      if (!snapshot) return;

      const cached = cacheRef.current;
      const unchanged =
        cached &&
        cached.thumbnail &&
        now - cached.at < SCAN_MAX_AGE_MS &&
        sceneDifference(cached.thumbnail, snapshot) < SCENE_CHANGE;
      if (unchanged) return;

      const frame = captureSharpestFrame(null, recentFramesRef.current) ?? latestFrame;
      if (!frame) return;

      busy = true;
      void requestScan(frame.url).then((result) => {
        busy = false;
        if (result.status !== "OK") return;
        cacheRef.current = { scan: { result, frame }, thumbnail: snapshot, at: performance.now() };
      });
    };

    checkCounter();
    const timer = window.setInterval(checkCounter, CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      if (preIdentifyTimerRef.current !== null) {
        window.clearInterval(preIdentifyTimerRef.current);
        preIdentifyTimerRef.current = null;
      }
      cacheRef.current = null;
      identityCacheRef.current = null;
      recentFramesRef.current = [];
      scanRef.current = null;
    };
  }, [cameraStatus, trackerStatus, videoRef, handSeenAtRef]);

  function stopPreIdentify() {
    if (preIdentifyTimerRef.current !== null) {
      window.clearInterval(preIdentifyTimerRef.current);
      preIdentifyTimerRef.current = null;
    }
  }

  function ensureIdentityCache(frameUrl: string): ScanIdentityCache {
    if (!identityCacheRef.current || identityCacheRef.current.frameUrl !== frameUrl) {
      identityCacheRef.current = createScanIdentityCache(frameUrl);
    }
    return identityCacheRef.current;
  }

  function startPreIdentify(scanPromise: Promise<Scan | null>) {
    stopPreIdentify();
    void scanPromise.then((resolvedScan) => {
      if (!resolvedScan || !holdingRef.current) return;
      const cache = ensureIdentityCache(resolvedScan.frame.url);
      const checkVisits = () => {
        if (!holdingRef.current) return;
        preIdentifyVisits(resolvedScan, pointing.peek(), products ?? [], cache);
      };
      checkVisits();
      preIdentifyTimerRef.current = window.setInterval(checkVisits, PRE_IDENTIFY_INTERVAL_MS);
    });
  }

  function handleHoldStart() {
    holdingRef.current = true;
    pointing.begin();

    const cached = cacheRef.current;
    const video = videoRef.current;
    const currentSnapshot = video && thumbnailerRef.current ? thumbnailerRef.current(video) : null;
    const sceneUnchanged =
      cached &&
      performance.now() - cached.at < SCAN_MAX_AGE_MS &&
      (!cached.thumbnail || !currentSnapshot || sceneDifference(cached.thumbnail, currentSnapshot) < SCENE_CHANGE);

    if (sceneUnchanged) {
      scanRef.current = Promise.resolve(cached.scan);
      startPreIdentify(scanRef.current);
      return;
    }

    // No recent unchanged background scan: capture the sharpest frame, scan immediately, retry once,
    // and fall back to the newest successful scan if available.
    const fallbackScan = cached?.scan ?? null;
    scanRef.current = scanWithFallback(
      () => captureSharpestFrame(videoRef.current, recentFramesRef.current),
      requestScan,
      fallbackScan,
      (scan) => {
        cacheRef.current = { scan, thumbnail: currentSnapshot, at: performance.now() };
      },
    );
    startPreIdentify(scanRef.current);
  }

  function handleHoldEnd(recording: Recording | null) {
    holdingRef.current = false;
    stopPreIdentify();
    const samples = pointing.end();
    const keyframes = pointing.takeKeyframes();
    const scan = scanRef.current;
    const identityCache = identityCacheRef.current;
    scanRef.current = null;
    cacheRef.current = null;
    identityCacheRef.current = null;
    recentFramesRef.current = [];
    if (!recording) return;

    const catalogue = products ?? [];
    void runHold({
      eventId: crypto.randomUUID(),
      wav: recording.wav,
      voiceHints: voiceKeywords(catalogue),
      productNames: catalogueKeywords(catalogue),
      // Grounding and identity run while the speech is transcribed, reusing pre-identified visits.
      located: locateTargets(scan, samples, catalogue, keyframes, undefined, identityCache),
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
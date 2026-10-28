"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { DwellDetector, type Dwell, type Ray } from "./dwell";
import { readAim } from "./gesture";
import { loadHandLandmarker } from "./hand-tracker";
import { PointFilter } from "./one-euro";

// 20 fps is enough to time a pause; nothing is drawn per frame.
const DETECT_INTERVAL_MS = 50;
// Pointing often starts just before the button is pressed.
const PRE_ROLL_MS = 1_500;
const MAX_DWELLS = 12;
const MIN_CUTOFF = 1.5;
const BETA = 4;

export type TrackerStatus = "loading" | "ready" | "error";

// Records where the finger paused without drawing anything. begin() and end() bracket one hold.
export function usePointingSession(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const [status, setStatus] = useState<TrackerStatus>("loading");
  const [count, setCount] = useState(0);
  const dwellsRef = useRef<Dwell[]>([]);
  const sinceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let frameId = 0;
    let lastRun = 0;
    const tipFilter = new PointFilter(MIN_CUTOFF, BETA);
    const baseFilter = new PointFilter(MIN_CUTOFF, BETA);
    const detector = new DwellDetector();

    const readRay = (landmarker: HandLandmarker, video: HTMLVideoElement, now: number): Ray | null => {
      const landmarks = landmarker.detectForVideo(video, now).landmarks[0];
      const aim = landmarks ? readAim(landmarks) : null;
      if (!aim) {
        tipFilter.reset();
        baseFilter.reset();
        return null;
      }

      const tip = tipFilter.filter(aim.tip, now);
      const base = baseFilter.filter(aim.base, now);
      const length = Math.hypot(tip.x - base.x, tip.y - base.y);
      if (!length) return null;

      return {
        tip,
        direction: { x: (tip.x - base.x) / length, y: (tip.y - base.y) / length },
        hand: aim.hand,
      };
    };

    const record = (dwell: Dwell, now: number) => {
      const since = sinceRef.current;
      const kept = [...dwellsRef.current, dwell]
        .filter((item) => (since !== null && item.at >= since) || now - item.at <= PRE_ROLL_MS)
        .slice(-MAX_DWELLS);
      dwellsRef.current = kept;
      if (since !== null) setCount(kept.filter((item) => item.at >= since).length);
    };

    const run = (landmarker: HandLandmarker) => {
      const tick = (now: number) => {
        frameId = requestAnimationFrame(tick);

        const video = videoRef.current;
        if (!video || !video.videoWidth || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        if (now - lastRun < DETECT_INTERVAL_MS) return;
        lastRun = now;

        let ray: Ray | null;
        try {
          ray = readRay(landmarker, video, now);
        } catch {
          // A dropped frame is not worth surfacing; the next tick tries again.
          return;
        }

        const dwell = detector.update(ray, now);
        if (dwell) record(dwell, now);
      };

      frameId = requestAnimationFrame(tick);
    };

    loadHandLandmarker()
      .then((landmarker) => {
        if (cancelled) return;
        setStatus("ready");
        run(landmarker);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      dwellsRef.current = [];
    };
  }, [enabled, videoRef]);

  const begin = useCallback(() => {
    const since = performance.now() - PRE_ROLL_MS;
    sinceRef.current = since;
    setCount(dwellsRef.current.filter((item) => item.at >= since).length);
  }, []);

  const end = useCallback((): Dwell[] => {
    const since = sinceRef.current;
    sinceRef.current = null;
    setCount(0);
    if (since === null) return [];

    const taken = dwellsRef.current.filter((item) => item.at >= since);
    dwellsRef.current = [];
    return taken;
  }, []);

  return { status, count, begin, end };
}
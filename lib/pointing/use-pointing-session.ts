"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import type { Point } from "@/lib/grounding/types";
import type { Ray } from "./dwell";
import { readAim } from "./gesture";
import { loadHandLandmarker } from "./hand-tracker";
import { PointFilter } from "./one-euro";
import type { TraceSample } from "./trace";

// 20 fps is enough to follow where the finger aims.
const DETECT_INTERVAL_MS = 50;
// Pointing often starts just before the button is pressed.
const PRE_ROLL_MS = 1_500;
// Two minutes at 20 fps, the longest hold.
const MAX_SAMPLES = 2_400;
// The hand indicator stays on through dropouts shorter than this.
const VISIBLE_HOLD_MS = 300;
// A fallback tap is recorded as a short pointing at that spot.
const TAP_MS = 400;
const MIN_CUTOFF = 1.5;
const BETA = 4;

export type TrackerStatus = "loading" | "ready" | "error";

// Records where the finger aims on every frame without drawing anything. begin() and end() bracket one hold.
export function usePointingSession(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const [status, setStatus] = useState<TrackerStatus>("loading");
  const [handVisible, setHandVisible] = useState(false);
  const samplesRef = useRef<TraceSample[]>([]);
  const sinceRef = useRef<number | null>(null);
  // Last time a hand was in view, so the counter is only scanned when it is clear.
  const handSeenAtRef = useRef(-Infinity);

  // Keeps the current hold plus a short pre-roll before it.
  const push = useCallback((sample: TraceSample) => {
    const floor = sinceRef.current ?? sample.at - PRE_ROLL_MS;
    const kept = samplesRef.current.filter((item) => item.at >= floor);
    kept.push(sample);
    samplesRef.current = kept.length > MAX_SAMPLES ? kept.slice(-MAX_SAMPLES) : kept;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let frameId = 0;
    let lastRun = 0;
    const tipFilter = new PointFilter(MIN_CUTOFF, BETA);
    const baseFilter = new PointFilter(MIN_CUTOFF, BETA);

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

        if (ray) {
          handSeenAtRef.current = now;
          push({ ...ray, at: now });
        }
        const visible = now - handSeenAtRef.current < VISIBLE_HOLD_MS;
        setHandVisible((current) => (current === visible ? current : visible));
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
      samplesRef.current = [];
      setHandVisible(false);
    };
  }, [enabled, videoRef, push]);

  const begin = useCallback(() => {
    sinceRef.current = performance.now() - PRE_ROLL_MS;
  }, []);

  const end = useCallback((): TraceSample[] => {
    const since = sinceRef.current;
    sinceRef.current = null;
    if (since === null) return [];

    const taken = samplesRef.current.filter((item) => item.at >= since);
    samplesRef.current = [];
    return taken;
  }, []);

  // Fallback when hand tracking is unavailable: a tap counts as pointing at that spot.
  const addTap = useCallback(
    (tip: Point) => {
      const now = performance.now();
      const sample = { tip, direction: { x: 0, y: 0 }, hand: { x1: tip.x, y1: tip.y, x2: tip.x, y2: tip.y } };
      push({ ...sample, at: now - TAP_MS });
      push({ ...sample, at: now });
    },
    [push],
  );

  return { status, handVisible, begin, end, addTap, handSeenAtRef };
}
"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import type { Point } from "@/lib/grounding/types";
import { readPointer, type HandPointer } from "./gesture";
import { loadHandLandmarker } from "./hand-tracker";

// About 15 fps is enough to detect a steady finger and keeps the phone cool.
const DETECT_INTERVAL_MS = 66;
// The fingertip must stay within STILL_RADIUS for DWELL_MS before the target is checked.
const DWELL_MS = 700;
const STILL_RADIUS = 0.03;
// Pointing this far from the checked spot starts a new target.
const RELEASE_RADIUS = 0.08;
// Without holdWhenLost, the target is released after the hand has been gone this long.
const LOST_MS = 800;

export type TrackerStatus = "loading" | "ready" | "error";

type FrameSize = { width: number; height: number };

export type Tracking = {
  pointer: HandPointer | null;
  /** 0..1 progress of the current dwell. */
  progress: number;
  frame: FrameSize | null;
};

type Options = {
  enabled: boolean;
  /** Keeps the current target while the hand is out of view, e.g. to press the mic. */
  holdWhenLost: boolean;
  onDwell: (pointer: HandPointer) => void;
  onRelease: () => void;
};

const IDLE: Tracking = { pointer: null, progress: 0, frame: null };

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function usePointing(videoRef: RefObject<HTMLVideoElement | null>, options: Options) {
  const [status, setStatus] = useState<TrackerStatus>("loading");
  const [tracking, setTracking] = useState<Tracking>(IDLE);
  const optionsRef = useRef(options);
  const { enabled } = options;

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let frameId = 0;
    let lastRun = 0;
    let lastSeen = 0;
    let anchor: { point: Point; since: number } | null = null;
    let locked: Point | null = null;

    const release = () => {
      locked = null;
      anchor = null;
      optionsRef.current.onRelease();
    };

    const showNoHand = (frame: FrameSize) => {
      // Skips re-rendering while nothing changes.
      setTracking((current) =>
        current.pointer === null &&
        current.frame?.width === frame.width &&
        current.frame?.height === frame.height
          ? current
          : { pointer: null, progress: 0, frame },
      );
    };

    const run = (landmarker: HandLandmarker) => {
      const tick = (now: number) => {
        frameId = requestAnimationFrame(tick);

        const video = videoRef.current;
        if (!video || !video.videoWidth || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        if (now - lastRun < DETECT_INTERVAL_MS) return;
        lastRun = now;

        const frame = { width: video.videoWidth, height: video.videoHeight };

        let pointer: HandPointer | null = null;
        try {
          const landmarks = landmarker.detectForVideo(video, now).landmarks[0];
          pointer = landmarks ? readPointer(landmarks) : null;
        } catch {
          // A dropped frame is not worth surfacing; the next tick tries again.
          return;
        }

        if (!pointer) {
          anchor = null;
          if (locked && !optionsRef.current.holdWhenLost && now - lastSeen > LOST_MS) release();
          showNoHand(frame);
          return;
        }

        lastSeen = now;

        if (locked) {
          if (distance(pointer.tip, locked) <= RELEASE_RADIUS) {
            setTracking({ pointer, progress: 1, frame });
            return;
          }
          release();
        }

        if (!anchor || distance(pointer.tip, anchor.point) > STILL_RADIUS) {
          anchor = { point: pointer.tip, since: now };
        }

        const progress = Math.min(1, (now - anchor.since) / DWELL_MS);
        if (progress === 1) {
          locked = pointer.tip;
          anchor = null;
          optionsRef.current.onDwell(pointer);
        }
        setTracking({ pointer, progress, frame });
      };

      frameId = requestAnimationFrame(tick);
    };

    loadHandLandmarker()
      .then((landmarker) => {
        if (cancelled) return;
        setStatus("ready");
        // Drops any target left over from before the camera restarted.
        optionsRef.current.onRelease();
        run(landmarker);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [enabled, videoRef]);

  return { status, tracking: enabled ? tracking : IDLE };
}
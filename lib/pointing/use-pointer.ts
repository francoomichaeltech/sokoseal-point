"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { castRay, withoutHand } from "@/lib/grounding/select";
import type { Box, Point, ScanResult, Selection } from "@/lib/grounding/types";
import { captureFrame } from "@/lib/media/capture";
import { drawPointer, type OverlayRefs } from "./draw";
import { readAim } from "./gesture";
import { loadHandLandmarker } from "./hand-tracker";
import { PointFilter } from "./one-euro";
import { createThumbnailer, sceneDifference, type Thumbnail } from "./scene";

// About 30 fps keeps the light smooth; the overlay is drawn on the same tick.
const DETECT_INTERVAL_MS = 33;
// The light must rest within STILL_RADIUS for DWELL_MS to select what is under it.
const DWELL_MS = 600;
const STILL_RADIUS = 0.025;
// After a selection, the light must move this far before another one can start.
const REARM_RADIUS = 0.06;
// Missed detections shorter than this keep the last position instead of hiding the light.
const COAST_MS = 400;
// How far ahead of the fingertip the light rests when the ray hits nothing.
const REACH = 0.15;
// A scan is reused until the scene changes or it gets old. Errors back off before retrying.
const SCAN_MAX_AGE_MS = 20_000;
const SCENE_CHECK_MS = 400;
const SCENE_CHANGE = 14;
const SCAN_RETRY_MS = 3_000;
// One Euro filter settings, tuned for normalized frame coordinates.
const MIN_CUTOFF = 1.5;
const BETA = 4;

export type TrackerStatus = "loading" | "ready" | "error";

type Size = { width: number; height: number };

export type Committed = (Selection | { status: "ERROR" }) & { frame: Size };

type Aim = { tip: Point; direction: Point; hand: Box };
type Scan = { boxes: Box[]; thumbnail: Thumbnail; hand: Box; at: number };

type Options = {
  enabled: boolean;
  overlay: OverlayRefs;
};

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function center(box: Box): Point {
  return { x: (box.x1 + box.x2) / 2, y: (box.y1 + box.y2) / 2 };
}

async function requestScan(image: string): Promise<ScanResult> {
  try {
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });
    return response.ok ? await response.json() : { status: "ERROR", latencyMs: 0 };
  } catch {
    return { status: "ERROR", latencyMs: 0 };
  }
}

export function usePointer(videoRef: RefObject<HTMLVideoElement | null>, options: Options) {
  const [status, setStatus] = useState<TrackerStatus>("loading");
  const [handVisible, setHandVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [committed, setCommitted] = useState<Committed | null>(null);
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
    let lastSceneCheck = 0;
    let retryAt = 0;

    let aim: Aim | null = null;
    let visible = false;
    let anchor: { point: Point; since: number } | null = null;
    let armed = true;
    let lockedAt: Point | null = null;
    let pending = false;

    let scan: Scan | null = null;
    let stale = false;
    let scanning = false;

    const tipFilter = new PointFilter(MIN_CUTOFF, BETA);
    const baseFilter = new PointFilter(MIN_CUTOFF, BETA);
    const thumbnail = createThumbnailer();

    const draw = (frame: Parameters<typeof drawPointer>[1]) => drawPointer(optionsRef.current.overlay, frame);

    const setVisible = (next: boolean) => {
      if (visible === next) return;
      visible = next;
      setHandVisible(next);
    };

    const setPending = (next: boolean) => {
      if (pending === next) return;
      pending = next;
      setChecking(next);
    };

    const commit = (selection: Selection | { status: "ERROR" }, frame: Size) => {
      setCommitted({ ...selection, frame });
    };

    const startScan = (video: HTMLVideoElement, hand: Box, frame: Size) => {
      const image = captureFrame(video);
      const snapshot = thumbnail(video);
      if (!image || !snapshot) return;

      scanning = true;
      void requestScan(image.url).then((result) => {
        if (cancelled) return;
        scanning = false;

        if (result.status === "OK") {
          // The hand was in the scanned frame; its own detection is dropped once here.
          scan = { boxes: withoutHand(result.boxes, hand), thumbnail: snapshot, hand, at: performance.now() };
          stale = false;
        } else {
          retryAt = performance.now() + SCAN_RETRY_MS;
        }

        if (!pending) return;
        setPending(false);
        if (result.status !== "OK") commit({ status: "ERROR" }, frame);
        else if (aim && scan) commit(castRay(scan.boxes, aim.tip, aim.direction).selection, frame);
      });
    };

    const run = (landmarker: HandLandmarker) => {
      const tick = (now: number) => {
        frameId = requestAnimationFrame(tick);

        const video = videoRef.current;
        if (!video || !video.videoWidth || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        if (now - lastRun < DETECT_INTERVAL_MS) return;
        lastRun = now;

        const frame = { width: video.videoWidth, height: video.videoHeight };

        let raw: ReturnType<typeof readAim> = null;
        try {
          const landmarks = landmarker.detectForVideo(video, now).landmarks[0];
          raw = landmarks ? readAim(landmarks) : null;
        } catch {
          return;
        }

        let current: Aim;
        if (raw) {
          lastSeen = now;
          const tip = tipFilter.filter(raw.tip, now);
          const base = baseFilter.filter(raw.base, now);
          const length = Math.hypot(tip.x - base.x, tip.y - base.y);
          const direction =
            length > 0
              ? { x: (tip.x - base.x) / length, y: (tip.y - base.y) / length }
              : (aim?.direction ?? { x: 0, y: -1 });
          current = { tip, direction, hand: raw.hand };
          aim = current;
        } else if (aim && now - lastSeen <= COAST_MS) {
          current = aim;
        } else {
          aim = null;
          anchor = null;
          tipFilter.reset();
          baseFilter.reset();
          setVisible(false);
          draw(null);
          return;
        }
        setVisible(true);

        const lastScan = scan;
        if (lastScan && now - lastSceneCheck >= SCENE_CHECK_MS) {
          lastSceneCheck = now;
          const snapshot = thumbnail(video);
          const moved =
            snapshot !== null &&
            sceneDifference(lastScan.thumbnail, snapshot, [current.hand, lastScan.hand]) > SCENE_CHANGE;
          if (moved || now - lastScan.at > SCAN_MAX_AGE_MS) stale = true;
        }
        if (!scanning && now >= retryAt && (!scan || stale)) startScan(video, current.hand, frame);

        const hit = castRay(scan?.boxes ?? [], current.tip, current.direction);
        const hover = hit.selection.status === "MATCH" ? hit.selection.box : null;
        // Snapping to the hovered object keeps the light still while the hand trembles.
        const spot = hover
          ? center(hover)
          : (hit.at ?? {
              x: clamp(current.tip.x + current.direction.x * REACH),
              y: clamp(current.tip.y + current.direction.y * REACH),
            });

        let progress = 1;
        if (armed) {
          if (!anchor || distance(spot, anchor.point) > STILL_RADIUS) anchor = { point: spot, since: now };
          progress = Math.min(1, (now - anchor.since) / DWELL_MS);

          if (progress === 1) {
            armed = false;
            lockedAt = spot;
            anchor = null;
            if (scan && !stale) commit(hit.selection, frame);
            else setPending(true);
          }
        } else if (lockedAt && distance(spot, lockedAt) > REARM_RADIUS) {
          armed = true;
          lockedAt = null;
          progress = 0;
          setPending(false);
          // A match stays until a new selection replaces it; other results only describe the spot just left.
          setCommitted((previous) => (previous?.status === "MATCH" ? previous : null));
        }

        draw({ tip: current.tip, spot, progress, hover, frame });
      };

      frameId = requestAnimationFrame(tick);
    };

    loadHandLandmarker()
      .then((landmarker) => {
        if (cancelled) return;
        setStatus("ready");
        // Drops a selection left over from before the camera restarted.
        setCommitted(null);
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

  return {
    status,
    handVisible: enabled && handVisible,
    checking: enabled && checking,
    committed: enabled ? committed : null,
  };
}
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mediaErrorStatus, type MediaFailure } from "./errors";
import { markGranted, wasGranted } from "./permissions";
import { stopTracks } from "./tracks";

export type CameraStatus = "checking" | "idle" | "starting" | "live" | MediaFailure;

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Bumped on every start and release so a late result from an older request is discarded.
  const requestRef = useRef(0);
  const [status, setStatus] = useState<CameraStatus>("checking");

  const release = useCallback(() => {
    requestRef.current += 1;
    stopTracks(streamRef.current);
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      return;
    }

    release();
    const request = requestRef.current;
    setStatus("starting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (request !== requestRef.current) {
        stopTracks(stream);
        return;
      }

      streamRef.current = stream;
      markGranted("camera");

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      if (request === requestRef.current) setStatus("live");
    } catch (error) {
      if (request === requestRef.current) setStatus(mediaErrorStatus(error));
    }
  }, [release]);

  useEffect(() => {
    let cancelled = false;
    let resumeOnVisible = false;

    void wasGranted("camera").then((granted) => {
      if (cancelled) return;
      if (granted) void start();
      else setStatus("idle");
    });

    // Mobile browsers end the stream when the tab is backgrounded.
    const onVisibilityChange = () => {
      if (document.hidden) {
        resumeOnVisible = streamRef.current !== null;
        release();
      } else if (resumeOnVisible) {
        void start();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release();
    };
  }, [release, start]);

  return { videoRef, status, start };
}
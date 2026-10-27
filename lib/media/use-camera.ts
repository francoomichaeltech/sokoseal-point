"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mediaErrorStatus, type MediaFailure } from "./errors";

export type CameraStatus = "idle" | "starting" | "live" | MediaFailure;

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    // getUserMedia only exists in secure contexts (HTTPS or localhost).
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      return;
    }

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

      stop();
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setStatus("live");
    } catch (error) {
      setStatus(mediaErrorStatus(error));
    }
  }, [stop]);

  // Releases the camera when the user leaves the page.
  useEffect(() => stop, [stop]);

  return { videoRef, status, start };
}
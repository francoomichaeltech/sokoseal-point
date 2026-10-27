"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mediaErrorStatus, type MediaFailure } from "./errors";
import { markGranted, wasGranted } from "./permissions";
import { stopTracks } from "./tracks";

export type MicStatus = "idle" | "listening" | MediaFailure;

export function useMic() {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [level, setLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const pendingRef = useRef<Promise<MediaStream | null> | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const frameRef = useRef(0);
  const heldRef = useRef(false);
  const mountedRef = useRef(false);

  // The stream stays open while Point is visible so a hold captures the first word.
  const acquire = useCallback(() => {
    if (streamRef.current?.active) return Promise.resolve(streamRef.current);

    pendingRef.current ??= navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (!mountedRef.current) {
          stopTracks(stream);
          return null;
        }
        streamRef.current = stream;
        markGranted("microphone");
        return stream;
      })
      .finally(() => {
        pendingRef.current = null;
      });

    return pendingRef.current;
  }, []);

  const stop = useCallback(() => {
    heldRef.current = false;
    cancelAnimationFrame(frameRef.current);
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    setLevel(0);
    setStatus((current) => (current === "listening" ? "idle" : current));
  }, []);

  const releaseStream = useCallback(() => {
    stop();
    stopTracks(streamRef.current);
    streamRef.current = null;
  }, [stop]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      return;
    }

    heldRef.current = true;
    // Created or resumed inside the gesture; iOS keeps it suspended otherwise.
    contextRef.current ??= new AudioContext();
    const context = contextRef.current;
    void context.resume();

    try {
      const stream = await acquire();
      // The button may have been released while the permission prompt was open.
      if (!stream || !heldRef.current) return;

      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      const samples = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let peak = 0;
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128));
        setLevel(peak / 128);
        frameRef.current = requestAnimationFrame(tick);
      };

      setStatus("listening");
      tick();
    } catch (error) {
      heldRef.current = false;
      if (mountedRef.current) setStatus(mediaErrorStatus(error));
    }
  }, [acquire]);

  useEffect(() => {
    mountedRef.current = true;

    const warmUp = () => {
      void wasGranted("microphone").then((granted) => {
        if (granted && mountedRef.current && !document.hidden) {
          // Errors surface on the next hold, so a failed warm-up is ignored here.
          acquire().catch(() => {});
        }
      });
    };

    const onVisibilityChange = () => {
      if (document.hidden) releaseStream();
      else warmUp();
    };

    warmUp();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      releaseStream();
      void contextRef.current?.close();
      contextRef.current = null;
    };
  }, [acquire, releaseStream]);

  return { status, level, start, stop };
}
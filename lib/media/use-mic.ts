"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addCaptureModule, CAPTURE_PROCESSOR } from "./capture-worklet";
import { mediaErrorStatus, type MediaFailure } from "./errors";
import { markGranted, wasGranted } from "./permissions";
import { stopTracks } from "./tracks";
import { encodeWav, resample, TARGET_SAMPLE_RATE } from "./wav";

// One hold is one request; longer holds are cut to keep upload and transcription short.
const MAX_RECORDING_MS = 15_000;
// Shorter holds are treated as accidental taps.
const MIN_RECORDING_MS = 400;

export type MicStatus = "idle" | "listening" | MediaFailure;

export type Recording = { wav: Blob; durationMs: number };

type Session = {
  source: MediaStreamAudioSourceNode;
  capture: AudioWorkletNode;
  sink: GainNode;
};

export function useMic() {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [level, setLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const pendingRef = useRef<Promise<MediaStream | null> | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const sampleCountRef = useRef(0);
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

  const teardownSession = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return;

    session.capture.port.onmessage = null;
    session.source.disconnect();
    session.capture.disconnect();
    session.sink.disconnect();
    setLevel(0);
  }, []);

  // Ends the hold and returns the recording, or null if nothing usable was captured.
  const stop = useCallback((): Recording | null => {
    heldRef.current = false;
    const context = contextRef.current;
    const wasRecording = sessionRef.current !== null;
    teardownSession();
    setStatus((current) => (current === "listening" ? "idle" : current));

    const chunks = chunksRef.current;
    chunksRef.current = [];
    sampleCountRef.current = 0;
    if (!wasRecording || !context) return null;

    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const durationMs = (total / context.sampleRate) * 1000;
    if (durationMs < MIN_RECORDING_MS) return null;

    const samples = new Float32Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }

    const wav = encodeWav(resample(samples, context.sampleRate), TARGET_SAMPLE_RATE);
    return { wav: new Blob([wav], { type: "audio/wav" }), durationMs };
  }, [teardownSession]);

  const releaseStream = useCallback(() => {
    heldRef.current = false;
    teardownSession();
    chunksRef.current = [];
    stopTracks(streamRef.current);
    streamRef.current = null;
  }, [teardownSession]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      return;
    }

    heldRef.current = true;
    chunksRef.current = [];
    sampleCountRef.current = 0;

    // Created or resumed inside the gesture; iOS keeps it suspended otherwise.
    contextRef.current ??= new AudioContext();
    const context = contextRef.current;
    void context.resume();

    try {
      const [stream] = await Promise.all([acquire(), addCaptureModule(context)]);
      // The button may have been released while the permission prompt was open.
      if (!stream || !heldRef.current || !mountedRef.current) return;

      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      const capture = new AudioWorkletNode(context, CAPTURE_PROCESSOR);
      // A muted sink keeps the capture node rendering without playing the mic back.
      const sink = context.createGain();
      sink.gain.value = 0;

      const maxSamples = (context.sampleRate * MAX_RECORDING_MS) / 1000;
      capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (sampleCountRef.current >= maxSamples) return;
        chunksRef.current.push(event.data);
        sampleCountRef.current += event.data.length;
      };

      source.connect(analyser);
      source.connect(capture);
      capture.connect(sink);
      sink.connect(context.destination);
      sessionRef.current = { source, capture, sink };

      const levels = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(levels);
        let peak = 0;
        for (const value of levels) peak = Math.max(peak, Math.abs(value - 128));
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
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mediaErrorStatus, type MediaFailure } from "./errors";

export type MicStatus = "idle" | "listening" | MediaFailure;

type Session = {
  stream: MediaStream;
  context: AudioContext;
  frame: number;
};

export function useMicLevel() {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [level, setLevel] = useState(0);
  const sessionRef = useRef<Session | null>(null);
  const heldRef = useRef(false);

  const release = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return;

    cancelAnimationFrame(session.frame);
    session.stream.getTracks().forEach((track) => track.stop());
    void session.context.close();
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      return;
    }

    heldRef.current = true;
    // Created before the await so it is tied to the user gesture; iOS keeps it suspended otherwise.
    const context = new AudioContext();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // The button may have been released while the permission prompt was open.
      if (!heldRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        void context.close();
        return;
      }

      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);

      const samples = new Uint8Array(analyser.fftSize);
      const session: Session = { stream, context, frame: 0 };

      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let peak = 0;
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128));
        setLevel(peak / 128);
        session.frame = requestAnimationFrame(tick);
      };

      sessionRef.current = session;
      setStatus("listening");
      tick();
    } catch (error) {
      heldRef.current = false;
      void context.close();
      setStatus(mediaErrorStatus(error));
    }
  }, []);

  const stop = useCallback(() => {
    heldRef.current = false;
    release();
    setLevel(0);
    setStatus((current) => (current === "listening" ? "idle" : current));
  }, [release]);

  useEffect(() => release, [release]);

  return { status, level, start, stop };
}
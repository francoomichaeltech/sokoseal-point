"use client";

import { useState } from "react";
import { Hand, Mic } from "lucide-react";
import { useMessages } from "@/lib/i18n/locale";
import { useMic, type Recording } from "@/lib/media/use-mic";

type HoldToSpeakProps = {
  onHoldStart: () => void;
  /** null when the hold was too short or cancelled. */
  onHoldEnd: (recording: Recording | null) => void;
  /** Whether the camera sees a hand right now; null when hand tracking is not in use. */
  handVisible: boolean | null;
};

export function HoldToSpeak({ onHoldStart, onHoldEnd, handVisible }: HoldToSpeakProps) {
  const { status, level, start, stop } = useMic();
  const t = useMessages().point;
  const [tooShort, setTooShort] = useState(false);

  function press() {
    setTooShort(false);
    onHoldStart();
    void start();
  }

  function release() {
    const wasListening = status === "listening";
    const recording = stop();
    setTooShort(wasListening && recording === null);
    onHoldEnd(recording);
  }

  function cancel() {
    stop();
    onHoldEnd(null);
  }

  const label =
    status === "listening"
      ? t.mic.listening
      : status === "idle"
        ? tooShort
          ? t.voice.tooShort
          : t.mic.hold
        : t.mic[status];

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <button
        type="button"
        aria-label={t.mic.hold}
        aria-pressed={status === "listening"}
        onPointerDown={(event) => {
          // Keeps pointerup on this button even if the finger slides off.
          event.currentTarget.setPointerCapture(event.pointerId);
          press();
        }}
        onPointerUp={release}
        onPointerCancel={cancel}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !event.repeat) {
            event.preventDefault();
            press();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") release();
        }}
        onContextMenu={(event) => event.preventDefault()}
        className="relative grid size-18 touch-none place-items-center rounded-full bg-primary text-white select-none"
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full border-4 border-primary/30"
          style={{ transform: `scale(${1 + level * 0.6})` }}
        />
        <Mic aria-hidden size={28} />
      </button>

      <p aria-live="polite" className="flex min-h-6 items-center gap-2 text-sm font-medium">
        {label}
        {status === "listening" && handVisible !== null && (
          <span className={`flex items-center gap-1 text-xs ${handVisible ? "text-verified" : "text-muted"}`}>
            <Hand aria-hidden size={14} />
            {handVisible ? t.pointing.handSeen : t.pointing.handMissing}
          </span>
        )}
      </p>
    </div>
  );
}
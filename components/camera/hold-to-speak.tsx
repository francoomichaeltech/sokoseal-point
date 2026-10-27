"use client";

import { Mic } from "lucide-react";
import { useMessages } from "@/lib/i18n/locale";
import { useMic } from "@/lib/media/use-mic";

export function HoldToSpeak() {
  const { status, level, start, stop } = useMic();
  const t = useMessages().point.mic;

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <button
        type="button"
        aria-label={t.hold}
        aria-pressed={status === "listening"}
        onPointerDown={(event) => {
          // Keeps pointerup on this button even if the finger slides off.
          event.currentTarget.setPointerCapture(event.pointerId);
          void start();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !event.repeat) {
            event.preventDefault();
            void start();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") stop();
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

      <p aria-live="polite" className="text-sm font-medium">
        {status === "idle" ? t.hold : t[status]}
      </p>
    </div>
  );
}
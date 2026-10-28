"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Mic } from "lucide-react";
import { useProducts } from "@/lib/catalogue/store";
import { useMessages } from "@/lib/i18n/locale";
import { useMic } from "@/lib/media/use-mic";
import { requestTranscript } from "@/lib/voice/client";
import { catalogueKeywords } from "@/lib/voice/keywords";

type Heard =
  | { state: "idle" }
  | { state: "processing" }
  | { state: "done"; transcript: string }
  | { state: "short" }
  | { state: "error" };

export function HoldToSpeak() {
  const { status, level, start, stop } = useMic();
  const products = useProducts();
  const t = useMessages().point;
  const [heard, setHeard] = useState<Heard>({ state: "idle" });
  // A new hold makes any transcript still in flight stale.
  const requestRef = useRef(0);

  function press() {
    requestRef.current += 1;
    void start();
  }

  async function release() {
    const wasListening = status === "listening";
    const recording = stop();
    if (!recording) {
      if (wasListening) setHeard({ state: "short" });
      return;
    }

    const id = requestRef.current;
    setHeard({ state: "processing" });
    const result = await requestTranscript(recording.wav, catalogueKeywords(products ?? []));
    if (id !== requestRef.current) return;

    setHeard(result.status === "OK" ? { state: "done", transcript: result.transcript } : { state: "error" });
  }

  function cancel() {
    requestRef.current += 1;
    stop();
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <p
        aria-live="polite"
        className="flex min-h-10 max-w-full items-center justify-center gap-1.5 px-2 text-center text-sm"
      >
        {heard.state === "processing" && (
          <>
            <LoaderCircle aria-hidden size={16} className="shrink-0 animate-spin" />
            {t.voice.processing}
          </>
        )}
        {heard.state === "done" &&
          (heard.transcript ? (
            <span className="line-clamp-2 font-medium">“{heard.transcript}”</span>
          ) : (
            <span className="text-muted">{t.voice.empty}</span>
          ))}
        {heard.state === "short" && <span className="text-muted">{t.voice.tooShort}</span>}
        {heard.state === "error" && <span className="text-danger">{t.voice.error}</span>}
      </p>

      <button
        type="button"
        aria-label={t.mic.hold}
        aria-pressed={status === "listening"}
        onPointerDown={(event) => {
          // Keeps pointerup on this button even if the finger slides off.
          event.currentTarget.setPointerCapture(event.pointerId);
          press();
        }}
        onPointerUp={() => void release()}
        onPointerCancel={cancel}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !event.repeat) {
            event.preventDefault();
            press();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") void release();
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

      <p className="text-sm font-medium">{status === "idle" ? t.mic.hold : t.mic[status]}</p>
    </div>
  );
}
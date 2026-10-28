"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Mic } from "lucide-react";
import { useProducts } from "@/lib/catalogue/store";
import { useMessages } from "@/lib/i18n/locale";
import { requestIntent } from "@/lib/intent/client";
import type { IntentResult } from "@/lib/intent/types";
import { useMic } from "@/lib/media/use-mic";
import { requestTranscript } from "@/lib/voice/client";
import { catalogueKeywords } from "@/lib/voice/keywords";

type Heard =
  | { state: "idle" }
  | { state: "processing" }
  | { state: "done"; transcript: string; intent: IntentResult }
  | { state: "short" }
  | { state: "error" };

const NO_ACTIONS: IntentResult = {
  status: "OK",
  intent: { actions: [], needsClarification: false },
  latencyMs: 0,
};

export function HoldToSpeak() {
  const { status, level, start, stop } = useMic();
  const products = useProducts();
  const t = useMessages().point;
  const [heard, setHeard] = useState<Heard>({ state: "idle" });
  // A new hold makes any request still in flight stale.
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

    const heardSpeech = await requestTranscript(recording.wav, catalogueKeywords(products ?? []));
    if (id !== requestRef.current) return;
    if (heardSpeech.status !== "OK") {
      setHeard({ state: "error" });
      return;
    }

    const intent = heardSpeech.transcript ? await requestIntent(heardSpeech.transcript) : NO_ACTIONS;
    if (id !== requestRef.current) return;
    setHeard({ state: "done", transcript: heardSpeech.transcript, intent });
  }

  function cancel() {
    requestRef.current += 1;
    stop();
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div
        aria-live="polite"
        className="flex min-h-10 w-full max-w-sm flex-col items-center justify-center gap-1.5 px-2 text-center text-sm"
      >
        {heard.state === "processing" && (
          <p className="flex items-center gap-1.5">
            <LoaderCircle aria-hidden size={16} className="shrink-0 animate-spin" />
            {t.voice.processing}
          </p>
        )}

        {heard.state === "done" && (
          <>
            {heard.transcript ? (
              <p className="line-clamp-2 font-medium">“{heard.transcript}”</p>
            ) : (
              <p className="text-muted">{t.voice.empty}</p>
            )}

            {heard.intent.status === "ERROR" ? (
              <p className="text-danger">{t.voice.error}</p>
            ) : heard.intent.intent.actions.length === 0 ? (
              heard.transcript && <p className="text-muted">{t.intent.none}</p>
            ) : (
              <ol className="flex max-h-28 w-full flex-col gap-1 overflow-y-auto text-left">
                {heard.intent.intent.actions.map((action, index) => (
                  <li
                    key={index}
                    className="flex items-baseline gap-2 rounded-control border border-line bg-surface px-2 py-1"
                  >
                    <span data-qty className="shrink-0 font-semibold">
                      {t.intent.actions[action.action]}{" "}
                      {action.quantity ?? (action.action === "REMOVE" ? t.intent.all : "?")}
                    </span>
                    <span className="truncate text-muted">
                      {t.intent.refs[action.reference]} · “{action.spoken}”
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {heard.intent.status === "OK" && heard.intent.intent.needsClarification && (
              <p className="text-attention">{t.intent.unclear}</p>
            )}
          </>
        )}

        {heard.state === "short" && <p className="text-muted">{t.voice.tooShort}</p>}
        {heard.state === "error" && <p className="text-danger">{t.voice.error}</p>}
      </div>

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
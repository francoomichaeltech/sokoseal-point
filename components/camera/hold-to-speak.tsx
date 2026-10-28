"use client";

import { useRef, useState, type ReactNode } from "react";
import { LoaderCircle, Mic } from "lucide-react";
import { useProducts } from "@/lib/catalogue/store";
import { useMessages } from "@/lib/i18n/locale";
import { requestIntent } from "@/lib/intent/client";
import type { Intent, IntentResult } from "@/lib/intent/types";
import { useMic } from "@/lib/media/use-mic";
import { requestTranscript } from "@/lib/voice/client";
import { catalogueKeywords } from "@/lib/voice/keywords";

type Heard =
  | { state: "idle" }
  | { state: "processing"; stage: "transcribing" | "understanding" }
  | { state: "done"; heard: string; intent: IntentResult }
  | { state: "short" }
  | { state: "error" };

type HoldToSpeakProps = {
  onHoldStart: () => void;
  /** accepted is false when the hold was too short or cancelled. Returns the number of finger pauses. */
  onHoldEnd: (accepted: boolean) => number;
  /** Called once per hold with the parsed request. */
  onIntent: (intent: Intent) => void;
  pointCount: number;
  /** Shown under the transcript when the request has actions. */
  children?: ReactNode;
};

const NO_ACTIONS: IntentResult = {
  status: "OK",
  intent: { transcript: "", actions: [], needsClarification: false },
  latencyMs: 0,
};

// Case and punctuation fixes alone are not worth showing the original for.
function sameWords(a: string, b: string) {
  const words = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .join(" ");
  return words(a) === words(b);
}

export function HoldToSpeak({ onHoldStart, onHoldEnd, onIntent, pointCount, children }: HoldToSpeakProps) {
  const { status, level, start, stop } = useMic();
  const products = useProducts();
  const t = useMessages().point;
  const [heard, setHeard] = useState<Heard>({ state: "idle" });
  // A new hold makes any request still in flight stale.
  const requestRef = useRef(0);

  function press() {
    requestRef.current += 1;
    onHoldStart();
    void start();
  }

  async function release() {
    const wasListening = status === "listening";
    const recording = stop();
    const pauses = onHoldEnd(recording !== null);
    if (!recording) {
      if (wasListening) setHeard({ state: "short" });
      return;
    }

    const id = requestRef.current;
    const keywords = catalogueKeywords(products ?? []);
    setHeard({ state: "processing", stage: "transcribing" });

    const speech = await requestTranscript(recording.wav, keywords);
    if (id !== requestRef.current) return;
    if (speech.status !== "OK") {
      setHeard({ state: "error" });
      return;
    }
    if (!speech.transcript) {
      setHeard({ state: "done", heard: "", intent: NO_ACTIONS });
      return;
    }

    setHeard({ state: "processing", stage: "understanding" });
    const intent = await requestIntent(speech.transcript, keywords, pauses);
    if (id !== requestRef.current) return;
    setHeard({ state: "done", heard: speech.transcript, intent });
    if (intent.status === "OK") onIntent(intent.intent);
  }

  function cancel() {
    requestRef.current += 1;
    stop();
    onHoldEnd(false);
  }

  const done = heard.state === "done" ? heard : null;
  const intent = done?.intent.status === "OK" ? done.intent.intent : null;
  const shown = intent?.transcript || done?.heard || "";
  const corrected = done !== null && shown !== "" && !sameWords(shown, done.heard);

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div
        aria-live="polite"
        className="flex min-h-10 w-full max-w-sm flex-col items-center justify-center gap-1.5 px-2 text-center text-sm"
      >
        {heard.state === "processing" && (
          <p className="flex items-center gap-1.5">
            <LoaderCircle aria-hidden size={16} className="shrink-0 animate-spin" />
            {t.voice[heard.stage]}
          </p>
        )}

        {done && (
          <>
            {shown ? (
              <p className="line-clamp-2 font-medium">“{shown}”</p>
            ) : (
              <p className="text-muted">{t.voice.empty}</p>
            )}
            {corrected && (
              <p className="line-clamp-1 text-xs text-muted">
                {t.voice.heard} “{done.heard}”
              </p>
            )}

            {done.intent.status === "ERROR" ? (
              <p className="text-danger">{t.voice.error}</p>
            ) : !intent || intent.actions.length === 0 ? (
              shown && <p className="text-muted">{t.intent.none}</p>
            ) : (
              children
            )}

            {intent?.needsClarification && <p className="text-attention">{t.intent.unclear}</p>}
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

      <p className="text-sm font-medium">
        {status === "idle" ? t.mic.hold : t.mic[status]}
        {status === "listening" && <span className="text-muted"> · {t.pointing.counted(pointCount)}</span>}
      </p>
    </div>
  );
}
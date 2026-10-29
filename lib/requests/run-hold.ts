import { requestIntent } from "@/lib/intent/client";
import type { Located } from "@/lib/pointing/locate";
import { requestTranscript } from "@/lib/voice/client";
import { setRequest, updateRequest } from "./store";

type HoldInput = {
  eventId: string;
  wav: Blob;
  keywords: string[];
  pauses: number;
  located: Promise<Located>;
};

// Runs outside React so it keeps going after Point navigates to the basket.
export async function runHold({ eventId, wav, keywords, pauses, located }: HoldInput) {
  setRequest({ eventId, phase: "processing" });
  const fail = () => updateRequest(eventId, { eventId, phase: "error" });

  const speech = await requestTranscript(wav, keywords);
  if (speech.status !== "OK") return fail();

  const intent = speech.transcript ? await requestIntent(speech.transcript, keywords, pauses) : null;
  if (intent && intent.status !== "OK") return fail();

  const { targets, objectCount } = await located;
  updateRequest(eventId, {
    eventId,
    phase: "ready",
    heard: speech.transcript,
    transcript: intent?.intent.transcript || speech.transcript,
    actions: intent?.intent.actions ?? [],
    needsClarification: intent?.intent.needsClarification ?? false,
    targets,
    pointed: pauses,
    objectCount,
  });
}
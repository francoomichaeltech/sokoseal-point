import { requestIntent } from "@/lib/intent/client";
import type { Located } from "@/lib/pointing/locate";
import { requestTranscript } from "@/lib/voice/client";
import { setRequest, updateRequest } from "./store";

type HoldInput = {
  eventId: string;
  wav: Blob;
  /** Recognition hints for Muse Voice: shop words and product names. */
  voiceHints: string[];
  /** Product names and aliases, given to the request parser. */
  productNames: string[];
  located: Promise<Located>;
};

// Runs outside React so it keeps going after Point navigates to the basket.
export async function runHold({ eventId, wav, voiceHints, productNames, located }: HoldInput) {
  setRequest({ eventId, phase: "processing" });
  const fail = () => updateRequest(eventId, { eventId, phase: "error" });

  // Pointing is resolved while the speech is transcribed, so the parser gets the real pointing count.
  const [speech, place] = await Promise.all([requestTranscript(wav, voiceHints), located]);
  if (speech.status !== "OK") return fail();

  const pointed = place.targets.length;
  const intent = speech.transcript ? await requestIntent(speech.transcript, productNames, pointed) : null;
  if (intent && intent.status !== "OK") return fail();

  updateRequest(eventId, {
    eventId,
    phase: "ready",
    heard: speech.transcript,
    transcript: intent?.intent.transcript || speech.transcript,
    actions: intent?.intent.actions ?? [],
    needsClarification: intent?.intent.needsClarification ?? false,
    targets: place.targets,
    pointed,
    objectCount: place.objectCount,
    handSeen: place.handSeen,
    evidence: place.evidence,
  });
}
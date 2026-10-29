import { requestIntent } from "@/lib/intent/client";
import { keepLongest } from "@/lib/pointing/fit";
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

  const intent = speech.transcript ? await requestIntent(speech.transcript, productNames, place.marks.length) : null;
  if (intent && intent.status !== "OK") return fail();

  const actions = intent?.intent.actions ?? [];
  const pointRequests = actions.filter((action) => action.reference === "POINT").length;
  const marks = pointRequests > 0 ? keepLongest(place.marks, pointRequests) : place.marks;

  updateRequest(eventId, {
    eventId,
    phase: "ready",
    heard: speech.transcript,
    transcript: intent?.intent.transcript || speech.transcript,
    actions,
    needsClarification: intent?.intent.needsClarification ?? false,
    targets: marks.map((mark) => mark.target),
    marks,
    pointed: marks.length,
    objectCount: place.objectCount,
    handSeen: place.handSeen,
  });
}
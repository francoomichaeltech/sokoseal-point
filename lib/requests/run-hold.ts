import { requestIntent } from "@/lib/intent/client";
import { fallbackParseIntent, formatTranscript, normalizeTranscript } from "@/lib/intent/normalize";
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

  // Pointing is resolved while the speech is transcribed, so the parser gets the real pointing count.
  const [speech, place] = await Promise.all([requestTranscript(wav, voiceHints), located]);
  const heardText = speech.status === "OK" ? speech.transcript : "";

  const intentResult = heardText ? await requestIntent(heardText, productNames, place.marks.length) : null;
  const resolvedIntent =
    intentResult?.status === "OK"
      ? intentResult.intent
      : heardText
        ? fallbackParseIntent(normalizeTranscript(heardText, productNames), productNames, place.marks.length)
        : place.marks.length > 0
          ? fallbackParseIntent("", productNames, place.marks.length)
          : null;

  const actions = resolvedIntent?.actions ?? [];
  const pointRequests = actions.filter((action) => action.reference === "POINT").length;
  const marks = pointRequests > 0 ? keepLongest(place.marks, pointRequests) : place.marks;
  const formattedTranscript = formatTranscript(resolvedIntent?.transcript || heardText);

  updateRequest(eventId, {
    eventId,
    phase: "ready",
    heard: heardText,
    transcript: formattedTranscript,
    actions,
    needsClarification: resolvedIntent?.needsClarification ?? false,
    targets: marks.map((mark) => mark.target),
    marks,
    pointed: marks.length,
    objectCount: place.objectCount,
    handSeen: place.handSeen,
    evidence: place.evidence,
    ...(place.extraEvidence ? { extraEvidence: place.extraEvidence } : {}),
  });
}
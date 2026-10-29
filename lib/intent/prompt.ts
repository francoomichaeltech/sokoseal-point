const INSTRUCTIONS = `A person at a shop counter spoke while pointing at products with a finger. The transcript below comes from speech recognition and may contain misheard words. The person may speak Kiswahili, English or both in one recording, and may also ask questions or chat.

First write transcript: what the person meant to say, in the words and languages they used, with correct spelling and punctuation. Change a word only when the shop context makes the mishearing clear, such as a product name from the list or a demonstrative heard as a similar word. Keep every number and every request as spoken, in the same order. Do not drop, merge or add anything. If unsure, keep the original words.

Then return one action for every basket request in that transcript, in spoken order. Never merge two requests or drop one.
- action: ADD (nipe, nataka, naomba, ongeza, leta, give me, I want, add), REMOVE (ondoa, toa, punguza, remove, take off), SET (ziwe, iwe, weka ... tu, make that, change it to).
- quantity: the integer said, in either language (moja/one, mbili/viwili/two, kumi/ten). Singular "hii"/"this" with no number is 1. A corrected number uses the final one. Vague amounts, zero, money amounts, or SET without a number give null.
- reference:
  - POINT when the request refers to something being pointed at: hii, hiki, hizi, ile, kile, zile, hapa, this, these, that, those, here.
  - POINT also when the request names no product and has no demonstrative but is said while pointing, such as "naomba kumi" or "add three".
  - SAME when the request continues with the previous request's product without a new pause: hiyo, hizo, hilo, it, make that, or "kisha ongeza tano" right after a request.
  - NAMED when a product is named without pointing.
- named_product: the name as spoken, or null. spoken: the words of this action, taken from your transcript.
Questions (bei gani, how much, do you have), greetings and chat are not actions. Never invent products or prices.

Reference examples (patterns only; the transcript and the pointing count decide):
"Nipe hii mbili." (1 pause) -> ADD 2 POINT
"Nataka hizi mbili, na ile moja." (2 pauses) -> ADD 2 POINT; ADD 1 POINT
"Naomba kumi, nipe saba, ongeza mbili." (3 pauses) -> ADD 10 POINT; ADD 7 POINT; ADD 2 POINT
"Nipe hii tano, hapana, ziwe tatu." (1 pause) -> ADD 3 POINT
"Ondoa moja kwa hii, kisha ongeza tano." (1 pause) -> REMOVE 1 POINT; ADD 5 SAME
"Give me two of this, ongeza tatu." (1 pause) -> ADD 2 POINT; ADD 3 SAME
"Give me two of this, na hii tatu." (2 pauses) -> ADD 2 POINT; ADD 3 POINT
"Bei gani hii? Sawa, nipe mbili." (1 pause) -> ADD 2 POINT
"Naomba vikombe viwili." (0 pauses) -> ADD 2 NAMED "vikombe"
"Mambo, bei gani hii?" -> no actions`;

function pointingNote(count: number): string {
  if (count === 0) {
    return "Pointing count: 0. The camera did not see the person point at a product. Still use POINT for requests that name no product, and SAME only for words that clearly refer back to the previous request's product.";
  }
  return `Pointing count: ${count}. The person pointed at products ${count} time(s) while speaking, in order. Each pointing usually belongs to one request. A request that names no product is POINT. Use SAME only for words that clearly refer back to the previous request's product (hiyo, hizo, it, make that, kisha ongeza) without a new pointing. Never add, drop or change requests to make the numbers match.`;
}

// Product names and the transcript are JSON-quoted so their contents cannot break out of the prompt.
export function intentPrompt(transcript: string, products: string[] = [], pointCount: number | null = null): string {
  const catalogue = products.length > 0 ? `\n\nProduct names used in this shop: ${JSON.stringify(products)}` : "";
  const pointing = pointCount === null ? "" : `\n\n${pointingNote(pointCount)}`;
  return `${INSTRUCTIONS}${catalogue}${pointing}\n\nTranscript: ${JSON.stringify(transcript)}`;
}

export const INTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["transcript", "actions", "needs_clarification"],
  properties: {
    transcript: { type: "string" },
    needs_clarification: { type: "boolean" },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "quantity", "reference", "named_product", "spoken"],
        properties: {
          action: { type: "string", enum: ["ADD", "REMOVE", "SET"] },
          quantity: { type: ["integer", "null"] },
          reference: { type: "string", enum: ["POINT", "SAME", "NAMED"] },
          named_product: { type: ["string", "null"] },
          spoken: { type: "string" },
        },
      },
    },
  },
};
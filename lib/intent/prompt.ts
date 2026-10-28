const INSTRUCTIONS = `A person at a shop counter said the transcript below while pointing at products. It is usually Kiswahili, sometimes English or mixed.

Return one action for every request, in spoken order. Never merge two requests or drop one.
- action: ADD (nipe, nataka, naomba, ongeza, give me, I want), REMOVE (ondoa, toa, punguza, remove), SET (ziwe, iwe, weka ... tu, make that).
- quantity: integer. Singular "hii"/"this" with no number is 1. A corrected number uses the final one. Vague amounts, zero, money amounts, or SET without a number give null.
- reference: POINT for hii, hiki, hizi, ile, kile, zile, this, these, that, those. SAME for hiyo, hizo, hilo, it, make that, or a follow-on like "kisha ongeza tano". NAMED when a product is named without pointing.
- named_product: the name as spoken, or null. spoken: the words of this action.
Greetings and price questions are not actions. Never invent products or prices.

Reference examples (patterns only):
"Nipe hii mbili." -> ADD 2 POINT
"Nataka hizi mbili, na ile moja." -> ADD 2 POINT; ADD 1 POINT
"Nipe hii tano, hapana, ziwe tatu." -> ADD 3 POINT
"Ondoa moja kwa hii, kisha ongeza tano." -> REMOVE 1 POINT; ADD 5 SAME
"Naomba vikombe viwili." -> ADD 2 NAMED "vikombe"
"Two of these and one of that." -> ADD 2 POINT; ADD 1 POINT
"Mambo, bei gani hii?" -> no actions`;

// JSON-quoted so quotes or newlines in speech cannot break out of the transcript.
export function intentPrompt(transcript: string): string {
  return `${INSTRUCTIONS}\n\nTranscript: ${JSON.stringify(transcript)}`;
}

export const INTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["actions", "needs_clarification"],
  properties: {
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